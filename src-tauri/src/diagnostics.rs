//! Diagnostic snapshot of the running app — version, OS, dependency versions,
//! filesystem paths, and feature flags. Surfaced through Settings → About so
//! users can paste it into bug reports.

use crate::{AppError, AppResult};
use ffmpeg_sidecar::command::FfmpegCommand;
use ffmpeg_sidecar::event::FfmpegEvent;
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct Features {
    pub bg_removal: bool,
}

#[derive(Debug, Serialize)]
pub struct Diagnostics {
    pub app_version: &'static str,
    pub os: &'static str,
    pub arch: &'static str,
    pub ffmpeg_available: bool,
    pub ffmpeg_version: Option<String>,
    pub app_data_dir: Option<String>,
    pub log_dir: Option<String>,
    pub features: Features,
}

fn ffmpeg_version() -> Option<String> {
    let mut child = FfmpegCommand::new().arg("-version").spawn().ok()?;
    let events = child.iter().ok()?;
    let mut version = None;
    for event in events {
        if let FfmpegEvent::ParsedVersion(v) = event {
            version = Some(v.version);
            break;
        }
    }
    let _ = child.wait();
    version
}

#[tauri::command]
pub async fn get_diagnostics(app: tauri::AppHandle) -> AppResult<Diagnostics> {
    let ffmpeg_available = crate::plugins::video::ensure_ffmpeg().is_ok();
    let ffmpeg_version = if ffmpeg_available {
        ffmpeg_version()
    } else {
        None
    };

    let path = app.path();
    let app_data_dir = path.app_data_dir().ok().map(|p| p.display().to_string());
    let log_dir = path.app_log_dir().ok().map(|p| p.display().to_string());

    Ok(Diagnostics {
        app_version: env!("CARGO_PKG_VERSION"),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        ffmpeg_available,
        ffmpeg_version,
        app_data_dir,
        log_dir,
        features: Features {
            bg_removal: cfg!(feature = "bg-removal"),
        },
    })
}

// Suppress the unused-import warning when the bg-removal feature is off —
// AppError isn't otherwise referenced in this module today.
#[allow(dead_code)]
fn _unused_error_ref(_e: AppError) {}
