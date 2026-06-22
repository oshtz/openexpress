pub mod commands;

use crate::{AppError, AppResult};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

static FFMPEG_READY: OnceLock<AppResult<()>> = OnceLock::new();

/// Per-job cancellation registry. Each video command registers an
/// `AtomicBool` under a caller-supplied job ID; the matching
/// `cancel_video_job(job_id)` command flips it.
#[derive(Default)]
pub struct CancellationRegistry {
    inner: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl CancellationRegistry {
    pub fn register(&self, job_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.inner
            .lock()
            .unwrap()
            .insert(job_id.to_string(), flag.clone());
        flag
    }

    pub fn deregister(&self, job_id: &str) {
        self.inner.lock().unwrap().remove(job_id);
    }

    pub fn cancel(&self, job_id: &str) -> bool {
        if let Some(flag) = self.inner.lock().unwrap().get(job_id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }
}

/// Ensures the bundled/downloaded ffmpeg binary is available.
/// On first call (per process) it triggers an auto-download if needed.
pub fn ensure_ffmpeg() -> AppResult<()> {
    let cached: &AppResult<()> = FFMPEG_READY.get_or_init(|| {
        if ffmpeg_sidecar::command::ffmpeg_is_installed() {
            return Ok(());
        }
        ffmpeg_sidecar::download::auto_download()
            .map_err(|e| AppError::FfmpegUnavailable(format!("auto-download failed: {e}")))
    });
    match cached {
        Ok(()) => Ok(()),
        Err(e) => Err(AppError::FfmpegUnavailable(e.to_string())),
    }
}

#[tauri::command]
pub fn cancel_video_job(job_id: String, registry: tauri::State<'_, CancellationRegistry>) -> bool {
    registry.cancel(&job_id)
}
