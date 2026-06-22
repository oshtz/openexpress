//! Windows shell-integration via the per-user registry.
//!
//! Layout (HKCU, no admin required):
//!
//! ```text
//!   Software\Classes\SystemFileAssociations\.jpg\shell\OpenExpress
//!     MUIVerb     = "OpenExpress"
//!     SubCommands = ""
//!     Icon        = "C:\Path\openexpress.exe,0"
//!
//!     \shell\image-resize
//!       MUIVerb = "Resize…"
//!       \command
//!         (Default) = "C:\Path\openexpress.exe" --tool image-resize "%1"
//! ```
//!
//! `register` writes the submenu and its child verbs beneath each supported
//! extension. `unregister` removes the OpenExpress-owned subtree.

use super::tools;
use crate::{AppError, AppResult};
use std::collections::BTreeMap;
use std::path::Path;
use winreg::enums::*;
use winreg::RegKey;

const SUBMENU_KEY: &str = "OpenExpress";
const PICKER_KEY_PATH: &str = r"Software\Classes\*\shell\OpenExpress";

fn wrap_io<P: AsRef<Path>>(path: P) -> impl FnOnce(std::io::Error) -> AppError {
    let p = path.as_ref().display().to_string();
    move |e| AppError::from_io(e, &p)
}

fn applies_to_supported_extensions() -> String {
    tools::all_extensions()
        .iter()
        .map(|ext| format!(r#"System.FileExtension:=".{ext}""#))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn register_picker_fallback(hkcu: &RegKey, exe_str: &str, icon: &str) -> AppResult<()> {
    let (picker_key, _) = hkcu
        .create_subkey(PICKER_KEY_PATH)
        .map_err(wrap_io(PICKER_KEY_PATH))?;
    picker_key
        .set_value("MUIVerb", &"Open with OpenExpress")
        .map_err(wrap_io(PICKER_KEY_PATH))?;
    picker_key
        .set_value("Icon", &icon)
        .map_err(wrap_io(PICKER_KEY_PATH))?;
    picker_key
        .set_value("AppliesTo", &applies_to_supported_extensions())
        .map_err(wrap_io(PICKER_KEY_PATH))?;

    let command_path = format!(r"{PICKER_KEY_PATH}\command");
    let (cmd_key, _) = hkcu
        .create_subkey(&command_path)
        .map_err(wrap_io(&command_path))?;
    let cmd_line = format!(r#""{exe_str}" "%1""#);
    cmd_key
        .set_value("", &cmd_line)
        .map_err(wrap_io(&command_path))?;

    Ok(())
}

pub fn register(exe: &Path) -> AppResult<()> {
    let exe_str = exe.to_string_lossy().into_owned();
    let icon = format!("{exe_str},0");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // For each extension, write a self-contained
    // SystemFileAssociations\<ext>\shell\OpenExpress cascading submenu.
    // Keeping child verbs directly under the submenu avoids CommandStore lookup
    // differences across Windows 10/11 and per-user registry views.
    let mut by_ext: BTreeMap<&'static str, Vec<&tools::ToolSpec>> = BTreeMap::new();
    for t in tools::tools() {
        for ext in t.extensions {
            by_ext.entry(*ext).or_default().push(t);
        }
    }

    for (ext, ext_tools) in by_ext {
        let assoc_path =
            format!(r"Software\Classes\SystemFileAssociations\.{ext}\shell\{SUBMENU_KEY}");
        let (assoc_key, _) = hkcu
            .create_subkey(&assoc_path)
            .map_err(wrap_io(&assoc_path))?;
        assoc_key
            .set_value("MUIVerb", &"OpenExpress")
            .map_err(wrap_io(&assoc_path))?;
        assoc_key
            .set_value("Icon", &icon)
            .map_err(wrap_io(&assoc_path))?;
        assoc_key
            .set_value("SubCommands", &"")
            .map_err(wrap_io(&assoc_path))?;

        for t in ext_tools {
            let verb_path = format!(r"{assoc_path}\shell\{}", t.id);
            let (verb_key, _) = hkcu
                .create_subkey(&verb_path)
                .map_err(wrap_io(&verb_path))?;
            verb_key
                .set_value("MUIVerb", &t.label)
                .map_err(wrap_io(&verb_path))?;
            verb_key
                .set_value("Icon", &icon)
                .map_err(wrap_io(&verb_path))?;

            let command_path = format!(r"{verb_path}\command");
            let (cmd_key, _) = hkcu
                .create_subkey(&command_path)
                .map_err(wrap_io(&command_path))?;
            let cmd_line = format!(r#""{exe_str}" --tool {} "%1""#, t.id);
            cmd_key
                .set_value("", &cmd_line)
                .map_err(wrap_io(&command_path))?;
        }
    }

    register_picker_fallback(&hkcu, &exe_str, &icon)?;

    log::info!("shell integration: Windows registry entries written");
    Ok(())
}

pub fn unregister() -> AppResult<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Remove the per-extension submenu anchor.
    for ext in tools::all_extensions() {
        let assoc_path =
            format!(r"Software\Classes\SystemFileAssociations\.{ext}\shell\{SUBMENU_KEY}");
        // `delete_subkey_all` removes the key and its descendants; ignore "not
        // found" so a partial install can still be cleaned.
        if let Err(e) = hkcu.delete_subkey_all(&assoc_path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(AppError::from_io(e, &assoc_path));
            }
        }
    }

    // Remove the generic picker fallback.
    if let Err(e) = hkcu.delete_subkey_all(PICKER_KEY_PATH) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(AppError::from_io(e, PICKER_KEY_PATH));
        }
    }

    // Remove legacy CommandStore verbs from builds that used SubCommands.
    let command_store_path = r"Software\Classes\CommandStore\shell";
    for t in tools::tools() {
        let verb_path = format!(r"{command_store_path}\openexpress.{}", t.id);
        if let Err(e) = hkcu.delete_subkey_all(&verb_path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(AppError::from_io(e, &verb_path));
            }
        }
    }

    log::info!("shell integration: Windows registry entries removed");
    Ok(())
}

pub fn is_installed() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if hkcu.open_subkey(PICKER_KEY_PATH).is_ok() {
        return true;
    }

    // Probe by checking whether any of our extensions has the submenu key.
    tools::all_extensions().iter().any(|ext| {
        let path = format!(r"Software\Classes\SystemFileAssociations\.{ext}\shell\{SUBMENU_KEY}");
        hkcu.open_subkey(&path).is_ok()
    })
}
