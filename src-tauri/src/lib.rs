mod assets;
mod cli;
mod desktop_lifecycle;
mod diagnostics;
mod error;
#[cfg(target_os = "macos")]
mod macos_services;
mod output;
mod plugins;
mod shell;
mod updater;

pub use error::{AppError, AppResult};

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::default()
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("openexpress".into()),
            }),
        ])
        .max_file_size(5 * 1024 * 1024)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
        .build();

    tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second launch handoff: parse the incoming argv, restore the
            // existing window, and emit launch-action so the React layer routes
            // to the right tool.
            if let Some(action) = cli::parse(argv) {
                desktop_lifecycle::show_main_window(app);
                if let Err(e) = app.emit("launch-action", &action) {
                    log::warn!("failed to emit launch-action: {e}");
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(plugins::video::CancellationRegistry::default())
        .setup(|app| {
            log::info!(
                "openexpress {} starting on {}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS
            );
            #[cfg(target_os = "macos")]
            macos_services::register(app.handle().clone());
            desktop_lifecycle::setup(app)?;
            updater::cleanup_update_backups();

            // First-launch CLI args. We emit asynchronously so the frontend
            // has time to register its listener before the event fires.
            if let Some(action) = cli::parse(std::env::args_os()) {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    if let Err(e) = handle.emit("launch-action", &action) {
                        log::warn!("failed to emit initial launch-action: {e}");
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            assets::allow_asset_paths,
            // Image commands
            plugins::image::resize::resize_image,
            plugins::image::crop::crop_image,
            plugins::image::convert::convert_image,
            plugins::image::adjust::adjust_image,
            plugins::image::compress::compress_image,
            plugins::image::rotate::rotate_flip_image,
            plugins::image::sharpen::sharpen_image,
            plugins::image::blur::blur_image,
            plugins::image::vector_trace::vector_trace_image,
            plugins::image::remove_bg::remove_background,
            plugins::image::upscale::upscale_image,
            // Video commands
            plugins::video::commands::trim_video,
            plugins::video::commands::convert_video,
            plugins::video::commands::resize_video,
            plugins::video::commands::video_to_gif,
            plugins::video::commands::change_speed,
            plugins::video::commands::extract_audio,
            plugins::video::commands::crop_video,
            plugins::video::commands::reverse_video,
            plugins::video::commands::mute_video,
            plugins::video::commands::merge_videos,
            plugins::video::commands::get_video_info,
            plugins::video::cancel_video_job,
            // PDF commands
            plugins::pdf::merge::merge_pdfs,
            plugins::pdf::convert::images_to_pdf,
            plugins::pdf::compress::compress_pdf,
            plugins::pdf::split::split_pdf,
            plugins::pdf::organize::organize_pdf,
            plugins::audio::commands::trim_audio,
            plugins::audio::commands::convert_audio,
            plugins::audio::commands::fade_in_audio,
            plugins::audio::commands::fade_out_audio,
            plugins::audio::commands::adjust_audio_volume,
            // Clipboard bridging (image output + paste-as-file)
            plugins::clipboard::copy_image_to_clipboard,
            plugins::clipboard::paste_image_as_file,
            // ML model management (always registered; impl gated by ml-common)
            plugins::models::model_info,
            plugins::models::download_model,
            diagnostics::get_diagnostics,
            shell::shell_integration_status,
            shell::register_shell_integration,
            shell::unregister_shell_integration,
            updater::check_update,
            updater::download_update,
            updater::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
