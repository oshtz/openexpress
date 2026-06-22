//! Custom updater for the portable OpenExpress distribution.
//!
//! Windows updates swap the portable `.exe`. macOS updates keep the DMG as the
//! manual installer, but self-update consumes an `OpenExpress.app.zip` payload
//! and replaces the full `.app` bundle.

use crate::{AppError, AppResult};
use futures_util::StreamExt;
use semver::Version;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{ipc::Channel, Manager};
use tokio::io::AsyncWriteExt;

const APP_NAME: &str = "OpenExpress";
const APP_BUNDLE_IDENTIFIER: &str = "com.openexpress.desktop";
const MANIFEST_URL: &str =
    "https://github.com/oshtz/openexpress/releases/latest/download/latest.json";
const GITHUB_RELEASE_PREFIX: &str = "https://github.com/oshtz/openexpress/releases/download/";
const GITHUB_LATEST_PREFIX: &str = "https://github.com/oshtz/openexpress/releases/latest/download/";

#[derive(Debug, Deserialize)]
struct UpdateManifest {
    version: String,
    notes: Option<String>,
    #[serde(default)]
    pub_date: Option<String>,
    platforms: BTreeMap<String, ManifestPlatform>,
}

#[derive(Debug, Clone, Deserialize)]
struct ManifestPlatform {
    url: String,
    sha256: String,
    size: Option<u64>,
    bundle_identifier: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetInfo {
    platform: String,
    url: String,
    sha256: String,
    size: Option<u64>,
    kind: UpdateAssetKind,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum UpdateAssetKind {
    WindowsExe,
    MacosApp,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResponse {
    current_version: String,
    latest_version: Option<String>,
    available: bool,
    blocked: bool,
    reason: Option<String>,
    message: Option<String>,
    notes: Option<String>,
    pub_date: Option<String>,
    asset: Option<UpdateAssetInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedUpdate {
    version: String,
    path: String,
    kind: UpdateAssetKind,
    size: Option<u64>,
    sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDownloadProgress {
    downloaded: u64,
    total: u64,
    /// 0..=100; -1 when the remote server did not provide a reliable length.
    percent: f32,
}

#[derive(Debug, Clone)]
struct AvailableUpdate {
    version: String,
    notes: Option<String>,
    pub_date: Option<String>,
    asset: UpdateAssetInfo,
}

#[derive(Debug, Clone)]
struct UpdateBlock {
    reason: &'static str,
    message: String,
}

enum CheckOutcome {
    UpToDate {
        latest_version: String,
        notes: Option<String>,
        pub_date: Option<String>,
    },
    Available(AvailableUpdate),
    Blocked(UpdateBlock),
}

#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> AppResult<UpdateCheckResponse> {
    let current_version = current_version();
    match check_update_inner(&app).await? {
        CheckOutcome::UpToDate {
            latest_version,
            notes,
            pub_date,
        } => Ok(UpdateCheckResponse {
            current_version,
            latest_version: Some(latest_version),
            available: false,
            blocked: false,
            reason: None,
            message: Some("OpenExpress is up to date.".into()),
            notes,
            pub_date,
            asset: None,
        }),
        CheckOutcome::Available(update) => Ok(UpdateCheckResponse {
            current_version,
            latest_version: Some(update.version),
            available: true,
            blocked: false,
            reason: None,
            message: Some("An update is available.".into()),
            notes: update.notes,
            pub_date: update.pub_date,
            asset: Some(update.asset),
        }),
        CheckOutcome::Blocked(block) => Ok(blocked_response(current_version, block)),
    }
}

#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    progress: Channel<UpdateDownloadProgress>,
) -> AppResult<PreparedUpdate> {
    let update = match check_update_inner(&app).await? {
        CheckOutcome::Available(update) => update,
        CheckOutcome::UpToDate { .. } => {
            return Err(AppError::InvalidInput(
                "OpenExpress is already up to date.".into(),
            ))
        }
        CheckOutcome::Blocked(block) => return Err(block_to_error(block)),
    };

    download_available_update(&app, &update, progress).await
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    prepared_path: String,
    version: String,
) -> AppResult<()> {
    if cfg!(debug_assertions) {
        return Err(AppError::FeatureDisabled(
            "Updates are disabled in development builds.".into(),
        ));
    }

    let update_path = PathBuf::from(prepared_path);
    validate_prepared_update_path(&app, &update_path)?;

    if cfg!(target_os = "windows") {
        let current_exe = std::env::current_exe()
            .map_err(|e| AppError::Internal(format!("locating current executable: {e}")))?;
        ensure_parent_writable(&current_exe)?;
        spawn_windows_replacer(&update_path, &current_exe)?;
    } else if cfg!(target_os = "macos") {
        let current_bundle = current_macos_app_bundle()?;
        ensure_macos_bundle_is_updatable(&current_bundle)?;
        validate_macos_update_bundle(&update_path, &version)?;
        spawn_macos_replacer(&update_path, &current_bundle)?;
    } else {
        return Err(AppError::FeatureDisabled(
            "Self-update is only supported on Windows and macOS.".into(),
        ));
    }

    app.exit(0);
    Ok(())
}

pub fn cleanup_update_backups() {
    if cfg!(target_os = "windows") {
        if let Ok(current_exe) = std::env::current_exe() {
            let _ = fs::remove_file(backup_path(&current_exe));
        }
    } else if cfg!(target_os = "macos") {
        if let Ok(current_bundle) = current_macos_app_bundle() {
            let _ = fs::remove_dir_all(backup_path(&current_bundle));
        }
    }
}

async fn check_update_inner(app: &tauri::AppHandle) -> AppResult<CheckOutcome> {
    if cfg!(debug_assertions) {
        return Ok(CheckOutcome::Blocked(UpdateBlock {
            reason: "debugBuild",
            message: "Updates are disabled in development builds.".into(),
        }));
    }

    if let Some(block) = platform_block(app) {
        return Ok(CheckOutcome::Blocked(block));
    }

    let manifest = fetch_manifest().await?;
    let platform = match platform_key() {
        Some(platform) => platform,
        None => {
            return Ok(CheckOutcome::Blocked(UpdateBlock {
                reason: "unsupportedPlatform",
                message: "Self-update is only supported on Windows and macOS.".into(),
            }))
        }
    };

    let latest = parse_version(&manifest.version)?;
    let current = parse_version(&current_version())?;
    if latest <= current {
        return Ok(CheckOutcome::UpToDate {
            latest_version: manifest.version,
            notes: manifest.notes,
            pub_date: manifest.pub_date,
        });
    }

    let Some(asset) = manifest.platforms.get(&platform) else {
        return Ok(CheckOutcome::Blocked(UpdateBlock {
            reason: "unsupportedArchitecture",
            message: format!("No update asset is published for {platform}."),
        }));
    };
    validate_manifest_asset(asset)?;

    let kind = if cfg!(target_os = "windows") {
        UpdateAssetKind::WindowsExe
    } else {
        UpdateAssetKind::MacosApp
    };

    Ok(CheckOutcome::Available(AvailableUpdate {
        version: manifest.version,
        notes: manifest.notes,
        pub_date: manifest.pub_date,
        asset: UpdateAssetInfo {
            platform,
            url: asset.url.clone(),
            sha256: asset.sha256.clone(),
            size: asset.size,
            kind,
        },
    }))
}

async fn fetch_manifest() -> AppResult<UpdateManifest> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(format!("OpenExpress/{}", current_version()))
        .build()
        .map_err(|e| AppError::Internal(format!("updater HTTP client: {e}")))?;

    let resp = client
        .get(MANIFEST_URL)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("fetching update manifest: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "update manifest returned HTTP {}",
            resp.status()
        )));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("reading update manifest: {e}")))?;
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Internal(format!("parsing update manifest: {e}")))
}

async fn download_available_update(
    app: &tauri::AppHandle,
    update: &AvailableUpdate,
    progress: Channel<UpdateDownloadProgress>,
) -> AppResult<PreparedUpdate> {
    let updates_dir = updates_dir(app)?;
    fs::create_dir_all(&updates_dir)
        .map_err(|e| AppError::from_io(e, updates_dir.to_string_lossy()))?;

    let extension = match update.asset.kind {
        UpdateAssetKind::WindowsExe => "exe",
        UpdateAssetKind::MacosApp => "app.zip",
    };
    let file_name = format!("{APP_NAME}-{}.{}", safe_version(&update.version), extension);
    let download_path = updates_dir.join(file_name);
    let tmp_path = download_path.with_extension("download");
    let _ = fs::remove_file(&tmp_path);
    let _ = fs::remove_file(&download_path);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .user_agent(format!("OpenExpress/{}", current_version()))
        .build()
        .map_err(|e| AppError::Internal(format!("updater HTTP client: {e}")))?;
    let resp = client
        .get(&update.asset.url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("downloading update: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "update download returned HTTP {}",
            resp.status()
        )));
    }

    let expected_total = resp.content_length().or(update.asset.size).unwrap_or(0);
    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    let mut last_emit = 0_u64;
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| AppError::Internal(format!("update stream: {e}")))?;
        hasher.update(&bytes);
        file.write_all(&bytes)
            .await
            .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;
        downloaded += bytes.len() as u64;

        if downloaded - last_emit > 256 * 1024 || expected_total == downloaded {
            last_emit = downloaded;
            let _ = progress.send(progress_event(downloaded, expected_total));
        }
    }
    file.flush()
        .await
        .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;
    drop(file);

    let actual = hex_digest(&hasher.finalize());
    if !actual.eq_ignore_ascii_case(&update.asset.sha256) {
        let _ = fs::remove_file(&tmp_path);
        return Err(AppError::Internal(format!(
            "update checksum mismatch: expected {}, got {actual}",
            update.asset.sha256
        )));
    }

    fs::rename(&tmp_path, &download_path)
        .map_err(|e| AppError::from_io(e, download_path.to_string_lossy()))?;
    let _ = progress.send(progress_event(downloaded, expected_total));

    let prepared_path = if update.asset.kind == UpdateAssetKind::MacosApp {
        extract_macos_app_zip(&download_path, &updates_dir, &update.version)?
    } else {
        download_path
    };

    Ok(PreparedUpdate {
        version: update.version.clone(),
        path: prepared_path.to_string_lossy().into_owned(),
        kind: update.asset.kind,
        size: update.asset.size,
        sha256: update.asset.sha256.clone(),
    })
}

fn platform_block(_app: &tauri::AppHandle) -> Option<UpdateBlock> {
    if cfg!(target_os = "windows") {
        match std::env::current_exe() {
            Ok(current_exe) => ensure_parent_writable(&current_exe)
                .err()
                .map(|e| UpdateBlock {
                    reason: "installLocationNotWritable",
                    message: e.to_string(),
                }),
            Err(e) => Some(UpdateBlock {
                reason: "unknownInstallLocation",
                message: format!("Could not locate the running executable: {e}"),
            }),
        }
    } else if cfg!(target_os = "macos") {
        match current_macos_app_bundle() {
            Ok(bundle) => ensure_macos_bundle_is_updatable(&bundle)
                .err()
                .map(|e| UpdateBlock {
                    reason: "macosBundleNotUpdatable",
                    message: e.to_string(),
                }),
            Err(e) => Some(UpdateBlock {
                reason: "unknownAppBundle",
                message: e.to_string(),
            }),
        }
    } else {
        Some(UpdateBlock {
            reason: "unsupportedPlatform",
            message: "Self-update is only supported on Windows and macOS.".into(),
        })
    }
}

fn platform_key() -> Option<String> {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        return None;
    };

    Some(format!("{}-{}", os, std::env::consts::ARCH))
}

fn updates_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_cache_dir()
        .map_err(|e| AppError::Internal(format!("locating app cache dir: {e}")))?;
    Ok(base.join("updates"))
}

fn validate_prepared_update_path(app: &tauri::AppHandle, update_path: &Path) -> AppResult<()> {
    let updates_dir = updates_dir(app)?;
    let updates_dir = updates_dir
        .canonicalize()
        .map_err(|e| AppError::from_io(e, updates_dir.to_string_lossy()))?;
    let update_path = update_path
        .canonicalize()
        .map_err(|e| AppError::from_io(e, update_path.to_string_lossy()))?;
    if !update_path.starts_with(&updates_dir) {
        return Err(AppError::InvalidInput(
            "Prepared update is outside the OpenExpress update cache.".into(),
        ));
    }
    Ok(())
}

fn current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn parse_version(value: &str) -> AppResult<Version> {
    Version::parse(value.trim().trim_start_matches('v'))
        .map_err(|e| AppError::Internal(format!("invalid update version '{value}': {e}")))
}

fn validate_manifest_asset(asset: &ManifestPlatform) -> AppResult<()> {
    if !asset.url.starts_with(GITHUB_RELEASE_PREFIX) && !asset.url.starts_with(GITHUB_LATEST_PREFIX)
    {
        return Err(AppError::InvalidInput(
            "Update asset URL must point to the OpenExpress GitHub release.".into(),
        ));
    }
    if asset.sha256.len() != 64 || !asset.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::InvalidInput(
            "Update asset must include a lowercase SHA-256 hex digest.".into(),
        ));
    }
    if cfg!(target_os = "macos") {
        match asset.bundle_identifier.as_deref() {
            Some(APP_BUNDLE_IDENTIFIER) => {}
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "macOS update asset must declare bundle identifier {APP_BUNDLE_IDENTIFIER}"
                )))
            }
        }
    }
    Ok(())
}

fn ensure_parent_writable(target: &Path) -> AppResult<()> {
    let parent = target
        .parent()
        .ok_or_else(|| AppError::InvalidInput("Install target has no parent directory.".into()))?;
    let probe = parent.join(format!(".openexpress-write-test-{}", std::process::id()));
    match fs::File::create(&probe).and_then(|mut f| f.write_all(b"ok")) {
        Ok(()) => {
            let _ = fs::remove_file(&probe);
            Ok(())
        }
        Err(e) => Err(AppError::PermissionDenied(format!(
            "{} is not writable ({e}). Move OpenExpress to a user-writable folder such as ~/Applications on macOS or your user profile on Windows.",
            parent.display()
        ))),
    }
}

fn ensure_macos_bundle_is_updatable(bundle: &Path) -> AppResult<()> {
    let bundle_str = bundle.to_string_lossy();
    if bundle_str.starts_with("/Volumes/") {
        return Err(AppError::InvalidInput(
            "OpenExpress is running from a mounted DMG. Drag it to Applications before using self-update.".into(),
        ));
    }
    ensure_parent_writable(bundle)
}

fn current_macos_app_bundle() -> AppResult<PathBuf> {
    let current_exe = std::env::current_exe()
        .map_err(|e| AppError::Internal(format!("locating current executable: {e}")))?;
    current_exe
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| AppError::Internal("Could not resolve the current .app bundle.".into()))
}

#[cfg(target_os = "macos")]
fn extract_macos_app_zip(zip_path: &Path, updates_dir: &Path, version: &str) -> AppResult<PathBuf> {
    let extract_dir = updates_dir.join(format!("{APP_NAME}-{}-app", safe_version(version)));
    let _ = fs::remove_dir_all(&extract_dir);
    fs::create_dir_all(&extract_dir)
        .map_err(|e| AppError::from_io(e, extract_dir.to_string_lossy()))?;

    let status = std::process::Command::new("ditto")
        .arg("-xk")
        .arg(zip_path)
        .arg(&extract_dir)
        .status()
        .map_err(|e| AppError::Internal(format!("extracting app zip: {e}")))?;
    if !status.success() {
        return Err(AppError::Internal(
            "Failed to extract OpenExpress.app.zip.".into(),
        ));
    }

    let app_path = extract_dir.join(format!("{APP_NAME}.app"));
    validate_macos_update_bundle(&app_path, version)?;
    Ok(app_path)
}

#[cfg(not(target_os = "macos"))]
fn extract_macos_app_zip(
    _zip_path: &Path,
    _updates_dir: &Path,
    _version: &str,
) -> AppResult<PathBuf> {
    Err(AppError::FeatureDisabled(
        "macOS app extraction is only available on macOS.".into(),
    ))
}

#[cfg(target_os = "macos")]
fn validate_macos_update_bundle(app_path: &Path, version: &str) -> AppResult<()> {
    if !app_path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Extracted update is not an app bundle: {}",
            app_path.display()
        )));
    }
    let executable = app_path.join("Contents/MacOS").join(APP_NAME);
    if !executable.exists() {
        return Err(AppError::InvalidInput(format!(
            "Extracted app bundle is missing {}",
            executable.display()
        )));
    }
    let identifier = macos_bundle_value(app_path, "CFBundleIdentifier")?;
    if identifier.as_deref() != Some(APP_BUNDLE_IDENTIFIER) {
        return Err(AppError::InvalidInput(format!(
            "Extracted app bundle identifier is {:?}, expected {APP_BUNDLE_IDENTIFIER}",
            identifier
        )));
    }
    let bundle_version = macos_bundle_value(app_path, "CFBundleShortVersionString")?;
    if bundle_version.as_deref() != Some(version.trim_start_matches('v')) {
        return Err(AppError::InvalidInput(format!(
            "Extracted app version is {:?}, expected {}",
            bundle_version, version
        )));
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn validate_macos_update_bundle(_app_path: &Path, _version: &str) -> AppResult<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_bundle_value(app_path: &Path, key: &str) -> AppResult<Option<String>> {
    let plist_path = app_path.join("Contents/Info.plist");
    let value = plist::Value::from_file(&plist_path)
        .map_err(|e| AppError::InvalidInput(format!("reading {}: {e}", plist_path.display())))?;
    Ok(value
        .as_dictionary()
        .and_then(|dict| dict.get(key))
        .and_then(plist::Value::as_string)
        .map(ToOwned::to_owned))
}

#[cfg(target_os = "windows")]
fn spawn_windows_replacer(source: &Path, target: &Path) -> AppResult<()> {
    let backup = backup_path(target);
    let script = format!(
        r#"$ErrorActionPreference = 'Stop'
$procId = {pid}
$source = '{source}'
$target = '{target}'
$backup = '{backup}'
while (Get-Process -Id $procId -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 200 }}
try {{
  if (Test-Path -LiteralPath $backup) {{ Remove-Item -LiteralPath $backup -Force }}
  if (Test-Path -LiteralPath $target) {{ Move-Item -LiteralPath $target -Destination $backup -Force }}
  Move-Item -LiteralPath $source -Destination $target -Force
  Start-Process -FilePath $target
  Start-Sleep -Seconds 3
  if (Test-Path -LiteralPath $backup) {{ Remove-Item -LiteralPath $backup -Force }}
}} catch {{
  if (Test-Path -LiteralPath $target) {{ Remove-Item -LiteralPath $target -Force }}
  if (Test-Path -LiteralPath $backup) {{ Move-Item -LiteralPath $backup -Destination $target -Force; Start-Process -FilePath $target }}
  throw
}}
"#,
        pid = std::process::id(),
        source = escape_powershell_literal(&source.to_string_lossy()),
        target = escape_powershell_literal(&target.to_string_lossy()),
        backup = escape_powershell_literal(&backup.to_string_lossy()),
    );

    std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .spawn()
        .map_err(|e| AppError::Internal(format!("starting updater helper: {e}")))?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn spawn_windows_replacer(_source: &Path, _target: &Path) -> AppResult<()> {
    Err(AppError::FeatureDisabled(
        "Windows update replacement is only available on Windows.".into(),
    ))
}

#[cfg(target_os = "macos")]
fn spawn_macos_replacer(source: &Path, target: &Path) -> AppResult<()> {
    let backup = backup_path(target);
    let script = format!(
        r#"set -e
pid={pid}
source='{source}'
target='{target}'
backup='{backup}'
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
if [ -e "$backup" ]; then rm -rf "$backup"; fi
if [ -e "$target" ]; then mv "$target" "$backup"; fi
if mv "$source" "$target"; then
  open "$target"
  sleep 3
  if [ -e "$backup" ]; then rm -rf "$backup"; fi
else
  rm -rf "$target"
  if [ -e "$backup" ]; then mv "$backup" "$target"; open "$target"; fi
  exit 1
fi
"#,
        pid = std::process::id(),
        source = escape_bash_literal(&source.to_string_lossy()),
        target = escape_bash_literal(&target.to_string_lossy()),
        backup = escape_bash_literal(&backup.to_string_lossy()),
    );

    std::process::Command::new("bash")
        .args(["-c", &script])
        .spawn()
        .map_err(|e| AppError::Internal(format!("starting updater helper: {e}")))?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn spawn_macos_replacer(_source: &Path, _target: &Path) -> AppResult<()> {
    Err(AppError::FeatureDisabled(
        "macOS app replacement is only available on macOS.".into(),
    ))
}

fn backup_path(target: &Path) -> PathBuf {
    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("OpenExpress");
    target.with_file_name(format!("{file_name}.old"))
}

fn block_to_error(block: UpdateBlock) -> AppError {
    match block.reason {
        "installLocationNotWritable" => AppError::PermissionDenied(block.message),
        "debugBuild" | "unsupportedPlatform" => AppError::FeatureDisabled(block.message),
        _ => AppError::InvalidInput(block.message),
    }
}

fn blocked_response(current_version: String, block: UpdateBlock) -> UpdateCheckResponse {
    UpdateCheckResponse {
        current_version,
        latest_version: None,
        available: false,
        blocked: true,
        reason: Some(block.reason.into()),
        message: Some(block.message),
        notes: None,
        pub_date: None,
        asset: None,
    }
}

fn progress_event(downloaded: u64, total: u64) -> UpdateDownloadProgress {
    UpdateDownloadProgress {
        downloaded,
        total,
        percent: if total == 0 {
            -1.0
        } else {
            ((downloaded as f64 / total as f64) * 100.0).min(100.0) as f32
        },
    }
}

fn hex_digest(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn safe_version(version: &str) -> String {
    version
        .trim_start_matches('v')
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn escape_powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "macos")]
fn escape_bash_literal(value: &str) -> String {
    value.replace('\'', "'\\''")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_version_accepts_v_prefix() {
        assert_eq!(
            parse_version("v1.2.3").unwrap(),
            Version::parse("1.2.3").unwrap()
        );
    }

    #[test]
    fn safe_version_replaces_path_separators() {
        assert_eq!(safe_version("v1.2.3/beta"), "1.2.3-beta");
    }

    #[test]
    fn progress_without_total_uses_negative_percent() {
        let progress = progress_event(100, 0);
        assert_eq!(progress.percent, -1.0);
    }
}
