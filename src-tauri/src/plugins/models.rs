//! Model catalog + auto-downloader for ML features.
//!
//! Always compiled — Tauri commands `model_info` and `download_model` are
//! always registered so the frontend can drive a uniform first-run UX. The
//! actual networking + checksum logic is gated behind `ml-common` (which
//! the `bg-removal` / `ai-upscale` features pull in); without that feature
//! both commands return `FeatureDisabled` and the heavy deps don't link.

use crate::{AppError, AppResult};
use serde::Serialize;
use tauri::ipc::Channel;

#[cfg(feature = "ml-common")]
use {
    futures_util::StreamExt,
    sha2::{Digest, Sha256},
    std::{fs::File, io, path::PathBuf},
    tauri::Manager,
    tokio::io::AsyncWriteExt,
};

// All fields are read only under `ml-common`; with `--no-default-features` the
// downloader is stubbed out and only the tests touch `MODELS`. Silence
// dead-code warnings so CI's `cargo clippy -- -D warnings` passes.
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct ArchiveSpec {
    pub members: &'static [ArchiveMember],
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct ArchiveMember {
    pub archive_path: &'static str,
    pub output_filename: &'static str,
}

#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub struct ModelSpec {
    pub id: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    /// Lowercase hex SHA-256. `None` = accept any file (model authors don't
    /// always publish hashes; users can manually drop a verified copy in).
    pub sha256: Option<&'static str>,
    pub approx_bytes: u64,
    pub description: &'static str,
    pub archive: Option<ArchiveSpec>,
}

#[derive(Debug, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub filename: String,
    pub approx_bytes: u64,
    pub description: String,
    pub installed: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    /// 0..=100; -1 when total is unknown.
    pub percent: f32,
}

#[allow(dead_code)]
pub const MODELS: &[ModelSpec] = &[
    // U-2-Net portable — 4.7 MB, Apache 2.0. Standard small bg-removal
    // model, used by `rembg` upstream. Input 320×320.
    ModelSpec {
        id: "u2netp",
        filename: "u2netp.onnx",
        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
        sha256: Some("309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8"),
        approx_bytes: 4_574_861,
        description: "Lightweight background-removal model (Apache 2.0).",
        archive: None,
    },
    // Qualcomm distributes the ONNX export as a zip with external data.
    // The URL in HuggingFace's model tree points to `release_assets.json`;
    // pin the resolved S3 artifact and verify the zip before extraction.
    ModelSpec {
        id: "realesrgan_x4plus",
        filename: "real_esrgan_x4plus.onnx",
        url: "https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/real_esrgan_x4plus/releases/v0.54.0/real_esrgan_x4plus-onnx-float.zip",
        sha256: Some("22e3c50151db75a1f4e68c3898097493fc2099ab51e91a796d3aa30085891fb2"),
        approx_bytes: 62_153_912,
        description: "Real-ESRGAN x4plus upscaler (BSD-3).",
        archive: Some(ArchiveSpec {
            members: &[
                ArchiveMember {
                    archive_path: "real_esrgan_x4plus-onnx-float/real_esrgan_x4plus.onnx",
                    output_filename: "real_esrgan_x4plus.onnx",
                },
                ArchiveMember {
                    archive_path: "real_esrgan_x4plus-onnx-float/real_esrgan_x4plus.data",
                    output_filename: "real_esrgan_x4plus.data",
                },
            ],
        }),
    },
];

#[allow(dead_code)]
pub fn find(id: &str) -> Option<&'static ModelSpec> {
    MODELS.iter().find(|m| m.id == id)
}

// ─── Path helpers (require app handle, so feature-gated) ─────────────────

#[cfg(feature = "ml-common")]
fn models_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("locating app data dir: {e}")))?;
    let dir = base.join("models");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::from_io(e, dir.to_string_lossy()))?;
    Ok(dir)
}

#[cfg(feature = "ml-common")]
pub fn model_path(app: &tauri::AppHandle, id: &str) -> AppResult<PathBuf> {
    let spec =
        find(id).ok_or_else(|| AppError::InvalidInput(format!("unknown model id '{id}'")))?;
    Ok(models_dir(app)?.join(spec.filename))
}

#[cfg(feature = "ml-common")]
pub fn is_present(app: &tauri::AppHandle, id: &str) -> bool {
    let spec = match find(id) {
        Some(spec) => spec,
        None => return false,
    };
    model_path(app, id)
        .map(|p| {
            p.exists()
                && spec.archive.map_or(true, |archive| {
                    let Some(dir) = p.parent() else {
                        return false;
                    };
                    archive
                        .members
                        .iter()
                        .all(|m| dir.join(m.output_filename).exists())
                })
        })
        .unwrap_or(false)
}

// ─── Tauri commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn model_info(app: tauri::AppHandle, id: String) -> AppResult<ModelInfo> {
    #[cfg(feature = "ml-common")]
    {
        let spec =
            find(&id).ok_or_else(|| AppError::InvalidInput(format!("unknown model id '{id}'")))?;
        let path = model_path(&app, &id)?;
        Ok(ModelInfo {
            id: spec.id.into(),
            filename: spec.filename.into(),
            approx_bytes: spec.approx_bytes,
            description: spec.description.into(),
            installed: is_present(&app, &id),
            path: path.to_string_lossy().into_owned(),
        })
    }
    #[cfg(not(feature = "ml-common"))]
    {
        let _ = (app, id);
        Err(AppError::FeatureDisabled(
            "ML features are disabled in this build. Rebuild with \
             --features bg-removal or --features ai-upscale."
                .into(),
        ))
    }
}

#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    id: String,
    progress: Channel<DownloadProgress>,
) -> AppResult<String> {
    #[cfg(feature = "ml-common")]
    {
        let spec =
            *find(&id).ok_or_else(|| AppError::InvalidInput(format!("unknown model id '{id}'")))?;
        let final_path = model_path(&app, &id)?;
        if is_present(&app, &id) {
            let _ = progress.send(DownloadProgress {
                downloaded: spec.approx_bytes,
                total: spec.approx_bytes,
                percent: 100.0,
            });
            return Ok(final_path.to_string_lossy().into_owned());
        }

        let tmp_path = final_path.with_extension("onnx.part");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| AppError::Internal(format!("http client: {e}")))?;

        let resp = client
            .get(spec.url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("model fetch ({}): {e}", spec.url)))?;
        if !resp.status().is_success() {
            return Err(AppError::Internal(format!(
                "model fetch failed: HTTP {} from {}",
                resp.status(),
                spec.url
            )));
        }
        let total = resp.content_length().unwrap_or(spec.approx_bytes).max(1);

        let mut file = tokio::fs::File::create(&tmp_path)
            .await
            .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;

        let mut hasher = Sha256::new();
        let mut downloaded: u64 = 0;
        let mut last_emit: u64 = 0;
        let mut stream = resp.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(|e| AppError::Internal(format!("download stream: {e}")))?;
            hasher.update(&bytes);
            file.write_all(&bytes)
                .await
                .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;
            downloaded += bytes.len() as u64;

            if downloaded - last_emit > 64 * 1024 || downloaded == total {
                last_emit = downloaded;
                let _ = progress.send(DownloadProgress {
                    downloaded,
                    total,
                    percent: ((downloaded as f64 / total as f64) * 100.0) as f32,
                });
            }
        }
        file.flush()
            .await
            .map_err(|e| AppError::from_io(e, tmp_path.to_string_lossy()))?;
        drop(file);

        if let Some(expected) = spec.sha256 {
            let actual = hex_digest(&hasher.finalize());
            if !actual.eq_ignore_ascii_case(expected) {
                let _ = std::fs::remove_file(&tmp_path);
                return Err(AppError::Internal(format!(
                    "model checksum mismatch for {id}: expected {expected}, got {actual}"
                )));
            }
        }

        if let Some(archive) = spec.archive {
            if let Err(e) = extract_archive_model(&tmp_path, &final_path, archive) {
                cleanup_archive_partials(&final_path, archive);
                let _ = std::fs::remove_file(&tmp_path);
                return Err(e);
            }
            let _ = std::fs::remove_file(&tmp_path);
        } else {
            std::fs::rename(&tmp_path, &final_path)
                .map_err(|e| AppError::from_io(e, final_path.to_string_lossy()))?;
        }

        let _ = progress.send(DownloadProgress {
            downloaded: total,
            total,
            percent: 100.0,
        });

        Ok(final_path.to_string_lossy().into_owned())
    }
    #[cfg(not(feature = "ml-common"))]
    {
        let _ = (app, id, progress);
        Err(AppError::FeatureDisabled(
            "ML features are disabled in this build.".into(),
        ))
    }
}

#[cfg(feature = "ml-common")]
fn cleanup_archive_partials(final_path: &std::path::Path, archive: ArchiveSpec) {
    let Some(dir) = final_path.parent() else {
        return;
    };
    for member in archive.members {
        let path = dir.join(member.output_filename);
        let _ = std::fs::remove_file(path.with_extension("part"));
    }
}

#[cfg(feature = "ml-common")]
fn extract_archive_model(
    archive_path: &std::path::Path,
    final_path: &std::path::Path,
    archive: ArchiveSpec,
) -> AppResult<()> {
    let Some(dir) = final_path.parent() else {
        return Err(AppError::Internal(
            "model path has no parent directory".into(),
        ));
    };

    let file = File::open(archive_path)
        .map_err(|e| AppError::from_io(e, archive_path.to_string_lossy()))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Internal(format!("opening model archive: {e}")))?;

    for member in archive.members {
        if member.archive_path.contains("..")
            || member.output_filename.contains('/')
            || member.output_filename.contains('\\')
        {
            return Err(AppError::Internal(format!(
                "unsafe model archive mapping: {} -> {}",
                member.archive_path, member.output_filename
            )));
        }

        let mut source = zip.by_name(member.archive_path).map_err(|e| {
            AppError::Internal(format!(
                "model archive missing required member '{}': {e}",
                member.archive_path
            ))
        })?;
        if source.is_dir() {
            return Err(AppError::Internal(format!(
                "model archive member '{}' is a directory",
                member.archive_path
            )));
        }

        let output_path = dir.join(member.output_filename);
        let part_path = output_path.with_extension("part");
        let mut output = File::create(&part_path)
            .map_err(|e| AppError::from_io(e, part_path.to_string_lossy()))?;
        io::copy(&mut source, &mut output)
            .map_err(|e| AppError::from_io(e, part_path.to_string_lossy()))?;
        std::fs::rename(&part_path, &output_path)
            .map_err(|e| AppError::from_io(e, output_path.to_string_lossy()))?;
    }

    Ok(())
}

#[cfg(feature = "ml-common")]
fn hex_digest(
    out: &sha2::digest::generic_array::GenericArray<u8, sha2::digest::typenum::U32>,
) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(64);
    for b in out.iter() {
        let _ = write!(s, "{:02x}", b);
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_model_has_unique_id() {
        let mut ids: Vec<_> = MODELS.iter().map(|m| m.id).collect();
        let count = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), count, "duplicate model id");
    }

    #[test]
    fn archive_models_have_safe_explicit_members() {
        for model in MODELS.iter().filter(|m| m.archive.is_some()) {
            let archive = model.archive.expect("archive checked above");
            assert!(
                model.sha256.is_some(),
                "archived model '{}' must pin the archive checksum",
                model.id
            );
            assert!(
                !archive.members.is_empty(),
                "archived model '{}' must extract at least one member",
                model.id
            );
            assert!(
                archive
                    .members
                    .iter()
                    .any(|m| m.output_filename == model.filename),
                "archived model '{}' must extract its primary filename",
                model.id
            );
            for member in archive.members {
                assert!(
                    !member.archive_path.contains(".."),
                    "unsafe archive path for '{}'",
                    model.id
                );
                assert!(
                    !member.output_filename.contains('/'),
                    "output filename must not contain slashes for '{}'",
                    model.id
                );
                assert!(
                    !member.output_filename.contains('\\'),
                    "output filename must not contain backslashes for '{}'",
                    model.id
                );
            }
        }
    }
}
