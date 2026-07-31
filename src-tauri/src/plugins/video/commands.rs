use crate::output::OutputFile;
use crate::{AppError, AppResult};
use ffmpeg_sidecar::command::FfmpegCommand;
use ffmpeg_sidecar::event::FfmpegEvent;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::ipc::Channel;

use super::CancellationRegistry;

/// Parses an ffmpeg time string like `00:03:29.04` into total seconds.
fn parse_ffmpeg_time(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let secs: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + secs)
}

pub(crate) fn run_ffmpeg(
    args: &[&str],
    progress: Option<&Channel<f32>>,
    cancel: &AtomicBool,
) -> AppResult<String> {
    super::ensure_ffmpeg()?;
    let requested_path = args
        .last()
        .ok_or_else(|| AppError::InvalidInput("ffmpeg output path is missing".into()))?;
    let output = OutputFile::new(*requested_path)?;
    let temp_path = output.path().to_string_lossy().into_owned();
    let mut safe_args = args[..args.len() - 1].to_vec();
    safe_args.push(&temp_path);

    let mut child = FfmpegCommand::new()
        .args(&safe_args)
        .spawn()
        .map_err(|e| AppError::FfmpegFailed(format!("Failed to spawn ffmpeg: {e}")))?;

    let mut total_duration: Option<f64> = None;
    let mut last_error: Option<String> = None;
    let mut cancelled = false;

    for event in child
        .iter()
        .map_err(|e| AppError::FfmpegFailed(format!("Failed to read ffmpeg events: {e}")))?
    {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            cancelled = true;
            break;
        }
        match event {
            FfmpegEvent::ParsedDuration(d) => total_duration = Some(d.duration),
            FfmpegEvent::Progress(p) => {
                if let (Some(dur), Some(ch)) = (total_duration, progress) {
                    if dur > 0.0 {
                        if let Some(current) = parse_ffmpeg_time(&p.time) {
                            let pct = (current / dur * 100.0).clamp(0.0, 100.0);
                            let _ = ch.send(pct as f32);
                        }
                    }
                }
            }
            FfmpegEvent::Error(msg)
            | FfmpegEvent::Log(ffmpeg_sidecar::event::LogLevel::Fatal, msg) => {
                last_error = Some(msg);
            }
            _ => {}
        }
    }

    let status = child
        .wait()
        .map_err(|e| AppError::FfmpegFailed(format!("Failed to wait for ffmpeg: {e}")))?;

    if cancelled {
        return Err(AppError::Cancelled);
    }

    if status.success() {
        let output_path = output.commit()?.to_string_lossy().into_owned();
        if let Some(ch) = progress {
            let _ = ch.send(100.0);
        }
        Ok(output_path)
    } else {
        Err(AppError::FfmpegFailed(last_error.unwrap_or_else(|| {
            format!("ffmpeg exited with status {:?}", status.code())
        })))
    }
}

/// RAII guard: registers a job ID on entry, deregisters on drop. Ensures the
/// registry is cleaned up even if a command panics or returns early.
pub(crate) struct JobGuard<'a> {
    registry: &'a CancellationRegistry,
    job_id: String,
    flag: std::sync::Arc<AtomicBool>,
}

impl<'a> JobGuard<'a> {
    pub(crate) fn new(registry: &'a CancellationRegistry, job_id: String) -> Self {
        let flag = registry.register(&job_id);
        Self {
            registry,
            job_id,
            flag,
        }
    }

    pub(crate) fn flag(&self) -> &AtomicBool {
        &self.flag
    }
}

impl Drop for JobGuard<'_> {
    fn drop(&mut self) {
        self.registry.deregister(&self.job_id);
    }
}

#[derive(Debug, Serialize)]
pub struct VideoResult {
    pub output_path: String,
    pub file_size: u64,
}

#[derive(Debug, Serialize)]
pub struct VideoInfo {
    pub duration_secs: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub file_size: u64,
}

fn file_size(path: &str) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

#[tauri::command]
pub async fn get_video_info(input_path: String) -> AppResult<VideoInfo> {
    super::ensure_ffmpeg()?;

    let mut child = FfmpegCommand::new()
        .input(&input_path)
        .args(["-f", "null", "-"])
        .spawn()
        .map_err(|e| AppError::FfmpegFailed(format!("Failed to spawn ffmpeg: {e}")))?;

    let mut width: u32 = 0;
    let mut height: u32 = 0;
    let mut codec = String::from("unknown");
    let mut duration_secs: f64 = 0.0;

    for event in child
        .iter()
        .map_err(|e| AppError::FfmpegFailed(format!("Failed to read ffmpeg events: {e}")))?
    {
        match event {
            FfmpegEvent::ParsedInputStream(stream) => {
                if let Some(video) = stream.video_data() {
                    width = video.width;
                    height = video.height;
                    codec = stream.format.clone();
                }
            }
            FfmpegEvent::ParsedDuration(d) => {
                duration_secs = d.duration;
            }
            _ => {}
        }
    }

    let _ = child.wait();

    if width == 0 || height == 0 {
        return Err(AppError::DecodeFailed("no video stream found".into()));
    }

    Ok(VideoInfo {
        duration_secs,
        width,
        height,
        codec,
        file_size: file_size(&input_path),
    })
}

#[tauri::command]
pub async fn trim_video(
    job_id: String,
    input_path: String,
    output_path: String,
    start_secs: f64,
    end_secs: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if end_secs <= start_secs {
        return Err(AppError::InvalidInput(format!(
            "end_secs ({end_secs}) must be greater than start_secs ({start_secs})"
        )));
    }

    let duration = end_secs - start_secs;
    let start_str = format!("{:.3}", start_secs);
    let duration_str = format!("{:.3}", duration);

    let guard = JobGuard::new(&registry, job_id);
    let output_path = run_ffmpeg(
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

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn convert_video(
    job_id: String,
    input_path: String,
    output_path: String,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    let guard = JobGuard::new(&registry, job_id);
    let output_path = run_ffmpeg(
        &["-i", &input_path, "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn resize_video(
    job_id: String,
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if width == 0 || height == 0 {
        return Err(AppError::InvalidInput(
            "width and height must be greater than 0".into(),
        ));
    }

    let scale = format!("scale={}:{}", width, height);
    let guard = JobGuard::new(&registry, job_id);

    let output_path = run_ffmpeg(
        &[
            "-i",
            &input_path,
            "-vf",
            &scale,
            "-c:a",
            "copy",
            "-y",
            &output_path,
        ],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn video_to_gif(
    job_id: String,
    input_path: String,
    output_path: String,
    fps: u32,
    width: i32,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if fps == 0 {
        return Err(AppError::InvalidInput("fps must be greater than 0".into()));
    }

    let filter = format!("fps={fps},scale={width}:-1:flags=lanczos");
    let guard = JobGuard::new(&registry, job_id);

    let output_path = run_ffmpeg(
        &["-i", &input_path, "-vf", &filter, "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn change_speed(
    job_id: String,
    input_path: String,
    output_path: String,
    speed: f64,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if !(0.25..=4.0).contains(&speed) {
        return Err(AppError::InvalidInput(format!(
            "speed must be between 0.25 and 4.0 (got {speed})"
        )));
    }

    let video_filter = format!("setpts={}*PTS", 1.0 / speed);
    let audio_filter = format!("atempo={}", speed.clamp(0.5, 2.0));
    let guard = JobGuard::new(&registry, job_id);

    let output_path = run_ffmpeg(
        &[
            "-i",
            &input_path,
            "-filter:v",
            &video_filter,
            "-filter:a",
            &audio_filter,
            "-y",
            &output_path,
        ],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
pub async fn extract_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    let guard = JobGuard::new(&registry, job_id);
    let output_path = run_ffmpeg(
        &["-i", &input_path, "-vn", "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn crop_video(
    job_id: String,
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    x: u32,
    y: u32,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if width == 0 || height == 0 {
        return Err(AppError::InvalidInput(
            "width and height must be greater than 0".into(),
        ));
    }

    let crop = format!("crop={width}:{height}:{x}:{y}");
    let guard = JobGuard::new(&registry, job_id);

    let output_path = run_ffmpeg(
        &[
            "-i",
            &input_path,
            "-vf",
            &crop,
            "-c:a",
            "copy",
            "-y",
            &output_path,
        ],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Reverse both video and audio streams. Memory-intensive for long clips
/// (ffmpeg buffers the whole stream) — fine for typical Adobe Express-style
/// short-form output, not a substitute for a streaming approach.
#[tauri::command]
pub async fn reverse_video(
    job_id: String,
    input_path: String,
    output_path: String,
    keep_audio: bool,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    let guard = JobGuard::new(&registry, job_id);
    let args: Vec<&str> = if keep_audio {
        vec![
            "-i",
            &input_path,
            "-vf",
            "reverse",
            "-af",
            "areverse",
            "-y",
            &output_path,
        ]
    } else {
        vec![
            "-i",
            &input_path,
            "-vf",
            "reverse",
            "-an",
            "-y",
            &output_path,
        ]
    };
    let output_path = run_ffmpeg(&args, Some(&progress), guard.flag())?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Strip the audio track. Uses `-c:v copy` so video is remuxed losslessly —
/// near-instant on any size of input.
#[tauri::command]
pub async fn mute_video(
    job_id: String,
    input_path: String,
    output_path: String,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    let guard = JobGuard::new(&registry, job_id);
    let output_path = run_ffmpeg(
        &["-i", &input_path, "-an", "-c:v", "copy", "-y", &output_path],
        Some(&progress),
        guard.flag(),
    )?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

/// Merge multiple videos with the concat filter, re-encoding so mismatched
/// codecs / resolutions / framerates stitch cleanly. (Concat demuxer is a
/// future optimization for identical-stream inputs.)
#[tauri::command]
pub async fn merge_videos(
    job_id: String,
    input_paths: Vec<String>,
    output_path: String,
    progress: Channel<f32>,
    registry: tauri::State<'_, CancellationRegistry>,
) -> AppResult<VideoResult> {
    if input_paths.len() < 2 {
        return Err(AppError::InvalidInput(
            "merge needs at least 2 input videos".into(),
        ));
    }

    // Build args: -i <path> for each input, then a concat filter that maps
    // each input's video+audio stream into a single output pair.
    let mut args: Vec<String> = Vec::with_capacity(input_paths.len() * 2 + 8);
    for p in &input_paths {
        args.push("-i".into());
        args.push(p.clone());
    }

    let n = input_paths.len();
    let mut filter = String::new();
    for i in 0..n {
        filter.push_str(&format!("[{i}:v:0][{i}:a:0?]"));
    }
    filter.push_str(&format!("concat=n={n}:v=1:a=1[outv][outa]"));

    args.push("-filter_complex".into());
    args.push(filter);
    args.push("-map".into());
    args.push("[outv]".into());
    args.push("-map".into());
    args.push("[outa]".into());
    args.push("-y".into());
    args.push(output_path.clone());

    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let guard = JobGuard::new(&registry, job_id);
    let output_path = run_ffmpeg(&arg_refs, Some(&progress), guard.flag())?;

    Ok(VideoResult {
        file_size: file_size(&output_path),
        output_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ffmpeg_time_handles_hhmmss() {
        assert_eq!(parse_ffmpeg_time("00:00:00.00"), Some(0.0));
        assert_eq!(parse_ffmpeg_time("00:01:30.50"), Some(90.5));
        assert_eq!(parse_ffmpeg_time("01:00:00.00"), Some(3600.0));
        assert_eq!(parse_ffmpeg_time("00:03:29.04"), Some(209.04));
    }

    #[test]
    fn parse_ffmpeg_time_rejects_garbage() {
        assert_eq!(parse_ffmpeg_time("not-a-time"), None);
        assert_eq!(parse_ffmpeg_time("12:34"), None);
        assert_eq!(parse_ffmpeg_time(""), None);
    }

    #[test]
    fn cancellation_registry_register_cancel_deregister() {
        let registry = CancellationRegistry::default();
        let flag = registry.register("job-1");
        assert!(!flag.load(Ordering::SeqCst));
        assert!(registry.cancel("job-1"));
        assert!(flag.load(Ordering::SeqCst));
        registry.deregister("job-1");
        assert!(!registry.cancel("job-1"), "deregistered job should be gone");
    }

    #[test]
    fn cancellation_registry_isolates_jobs() {
        let registry = CancellationRegistry::default();
        let a = registry.register("job-a");
        let b = registry.register("job-b");
        registry.cancel("job-a");
        assert!(a.load(Ordering::SeqCst));
        assert!(!b.load(Ordering::SeqCst), "cancelling A must not affect B");
    }
}
