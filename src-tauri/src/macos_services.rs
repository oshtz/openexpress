use std::{
    ffi::{c_char, CStr},
    sync::OnceLock,
    time::Duration,
};

use tauri::{AppHandle, Emitter};

use crate::{cli::LaunchAction, desktop_lifecycle, shell::tools};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

extern "C" {
    fn openexpress_register_services_provider(
        callback: extern "C" fn(*const c_char, *const c_char),
    );
}

pub fn register(app: AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
    if let Err(e) = app.run_on_main_thread(|| unsafe {
        openexpress_register_services_provider(handle_service);
    }) {
        log::warn!("failed to register macOS Services provider: {e}");
    }
}

extern "C" fn handle_service(tool_id: *const c_char, file_path: *const c_char) {
    let Some(app) = APP_HANDLE.get().cloned() else {
        log::warn!("macOS Services callback fired before app handle was registered");
        return;
    };
    let Some(tool_id) = c_string(tool_id) else {
        log::warn!("macOS Services callback was missing a tool id");
        return;
    };
    let Some(file_path) = c_string(file_path) else {
        log::warn!("macOS Services callback was missing a file path");
        return;
    };
    let Some(spec) = tools::find(&tool_id) else {
        log::warn!("macOS Services callback used unknown tool id: {tool_id}");
        return;
    };

    let action = LaunchAction {
        tool: Some(spec.id.to_string()),
        route: spec.route.to_string(),
        file: Some(file_path),
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
