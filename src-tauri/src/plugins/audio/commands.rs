//! Audio quick-action commands. Each command shells out to the bundled
//! ffmpeg via the shared `plugins::video::commands::run_ffmpeg` helper, and
//! registers with the same `CancellationRegistry` as the video pipeline so
//! `cancel_video_job` works for audio too (the registry is job-id keyed,
//! not category-keyed).

use crate::plugins::video::commands::JobGuard;
use crate::plugins::video::{commands::run_ffmpeg, CancellationRegistry};
use crate::{AppError, AppResult};
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Debug, Serialize)]
pub struct AudioResult {
    pub output_path: String,
    pub file_size: u64,
}

fn file_size(path: &str) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

#[tauri::command]
pub async fn trim_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    start_secs: f64,
    end_secs: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<AudioResult> {
    if end_secs <= start_secs {
        return Err(AppError::InvalidInput(format!(
            "end_secs ({end_secs}) must be greater than start_secs ({start_secs})"
        )));
    }
    let start_str = format!("{:.3}", start_secs);
    let duration_str = format!("{:.3}", end_secs - start_secs);
    let guard = JobGuard::new(&registry, job_id);

    run_ffmpeg(
        &[
            "-i",
            &input_path,
            "-ss",
            &start_str,
            "-t",
            &duration_str,
            "-c",
            "copy",
            "-y",
            &output_path,
        ],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(AudioResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn convert_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<AudioResult> {
    let guard = JobGuard::new(&registry, job_id);
    run_ffmpeg(
        &["-i", &input_path, "-vn", "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;
    Ok(AudioResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Linear fade-in over `duration_secs` from the start of the file. Other
/// audio is left untouched.
#[tauri::command]
pub async fn fade_in_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    duration_secs: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<AudioResult> {
    if !(0.0..=600.0).contains(&duration_secs) {
        return Err(AppError::InvalidInput(format!(
            "duration_secs must be in [0, 600] (got {duration_secs})"
        )));
    }
    let filter = format!("afade=t=in:st=0:d={duration_secs}");
    let guard = JobGuard::new(&registry, job_id);
    run_ffmpeg(
        &["-i", &input_path, "-af", &filter, "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;
    Ok(AudioResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Linear fade-out over the last `duration_secs` seconds of the file. The
/// fade is anchored to (total_duration - duration_secs); ffmpeg figures out
/// the start time from the input.
#[tauri::command]
pub async fn fade_out_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    duration_secs: f64,
    total_duration_secs: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<AudioResult> {
    if !(0.0..=600.0).contains(&duration_secs) {
        return Err(AppError::InvalidInput(format!(
            "duration_secs must be in [0, 600] (got {duration_secs})"
        )));
    }
    if total_duration_secs <= 0.0 {
        return Err(AppError::InvalidInput(
            "total_duration_secs must be positive".into(),
        ));
    }
    let start = (total_duration_secs - duration_secs).max(0.0);
    let filter = format!("afade=t=out:st={start}:d={duration_secs}");
    let guard = JobGuard::new(&registry, job_id);
    run_ffmpeg(
        &["-i", &input_path, "-af", &filter, "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;
    Ok(AudioResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Multiply audio volume by a linear gain factor. `gain` is 0..=10 — values
/// below 1 attenuate, above 1 amplify. (ffmpeg `volume=` accepts dB too via
/// "12dB"; we keep the API simple as a unitless factor.)
#[tauri::command]
pub async fn adjust_audio_volume(
    job_id: String,
    input_path: String,
    output_path: String,
    gain: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<AudioResult> {
    if !(0.0..=10.0).contains(&gain) {
        return Err(AppError::InvalidInput(format!(
            "gain must be in [0, 10] (got {gain})"
        )));
    }
    let filter = format!("volume={gain}");
    let guard = JobGuard::new(&registry, job_id);
    run_ffmpeg(
        &["-i", &input_path, "-af", &filter, "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;
    Ok(AudioResult {
        file_size: file_size(&output_path),
        output_path,
    })
}
