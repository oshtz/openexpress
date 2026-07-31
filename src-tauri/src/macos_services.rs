use std::{
    ffi::{c_char, CStr},
    sync::OnceLock,
    time::Duration,
};

use tauri::{AppHandle, Emitter};

use crate::{cli::LaunchAction, desktop_lifecycle};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

extern "C" {
    fn openexpress_register_services_provider(callback: extern "C" fn(*const *const c_char, usize));
}

pub fn register(app: AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
    if let Err(e) = app.run_on_main_thread(|| unsafe {
        openexpress_register_services_provider(handle_service);
    }) {
        log::warn!("failed to register macOS Services provider: {e}");
    }
}

extern "C" fn handle_service(file_paths: *const *const c_char, file_count: usize) {
    let Some(app) = APP_HANDLE.get().cloned() else {
        log::warn!("macOS Services callback fired before app handle was registered");
        return;
    };
    if file_paths.is_null() || file_count == 0 {
        log::warn!("macOS Services callback was missing file paths");
        return;
    }

    let files = unsafe { std::slice::from_raw_parts(file_paths, file_count) }
        .iter()
        .filter_map(|path| c_string(*path))
        .collect::<Vec<_>>();
    if files.is_empty() {
        log::warn!("macOS Services callback contained no valid file paths");
        return;
    }

    let action = LaunchAction {
        tool: None,
        route: "/pick".to_string(),
        files,
    };

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(200));
        desktop_lifecycle::show_main_window(&app);
        if let Err(e) = app.emit("launch-action", &action) {
            log::warn!("failed to emit macOS Services launch-action: {e}");
        }
    });
}

fn c_string(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }

    Some(
        unsafe { CStr::from_ptr(ptr) }
            .to_string_lossy()
            .into_owned(),
    )
}
