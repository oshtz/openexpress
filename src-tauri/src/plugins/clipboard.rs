//! Clipboard bridging: copy a rendered image into the OS clipboard, and turn
//! a clipboard image back into a temp file the rest of the pipeline can read.
//!
//! Goes through the JS-side clipboard-manager plugin via Rust so we don't have
//! to grant `allow-write-image` / `allow-read-image` to the webview. The Tauri
//! plugin's Image expects raw RGBA8 bytes, so we always decode through the
//! `image` crate to normalize JPEG/WEBP/BMP/TIFF outputs as well as PNG.

use crate::{AppError, AppResult};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::image::Image;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub async fn copy_image_to_clipboard<R: Runtime>(app: AppHandle<R>, path: String) -> AppResult<()> {
    // image::open handles jpg/png/webp/bmp/tiff via the features enabled in
    // Cargo.toml. We decode to RGBA8 because that's what the clipboard plugin
    // wants — width/height + tightly-packed RGBA bytes.
    let img = image::open(&path)?.to_rgba8();
    let (width, height) = img.dimensions();
    let bytes = img.into_raw();

    let tauri_image = Image::new_owned(bytes, width, height);
    app.clipboard()
        .write_image(&tauri_image)
        .map_err(|e| AppError::Internal(format!("clipboard write failed: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn paste_image_as_file<R: Runtime>(app: AppHandle<R>) -> AppResult<String> {
    // read_image clones the image bytes out of the OS clipboard immediately,
    // so we can drop the resource right after and don't have to thread a
    // lifetime back into async land.
    let img = app
        .clipboard()
        .read_image()
        .map_err(|e| AppError::InvalidInput(format!("no image on clipboard: {e}")))?;

    let width = img.width();
    let height = img.height();
    let rgba = img.rgba().to_vec();

    let buf = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| AppError::Internal("clipboard image buffer size mismatch".into()))?;

    let dir = clipboard_paste_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| AppError::from_io(e, dir.to_string_lossy().as_ref()))?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let out = dir.join(format!("clipboard-{nanos}.png"));

    buf.save(&out)?;
    Ok(out.to_string_lossy().into_owned())
}

fn clipboard_paste_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().temp_dir())
        .map_err(|e| AppError::Internal(format!("no writable cache dir: {e}")))?;
    Ok(base.join("clipboard-paste"))
}
