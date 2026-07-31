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
const MULTI_SELECT_MODEL: &str = "Player";
const SINGLE_SELECT_MODEL: &str = "Single";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistrationStatus {
    Missing,
    Active,
    NeedsRepair,
}

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

fn picker_command(exe: &str) -> String {
    format!(r#""{exe}" "%1""#)
}

fn tool_command(exe: &str, tool_id: &str) -> String {
    format!(r#""{exe}" --tool {tool_id} "%1""#)
}

fn selection_model(tool: &tools::ToolSpec) -> &'static str {
    if tool.accepts_multiple {
        MULTI_SELECT_MODEL
    } else {
        SINGLE_SELECT_MODEL
    }
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
    picker_key
        .set_value("MultiSelectModel", &MULTI_SELECT_MODEL)
        .map_err(wrap_io(PICKER_KEY_PATH))?;

    let command_path = format!(r"{PICKER_KEY_PATH}\command");
    let (cmd_key, _) = hkcu
        .create_subkey(&command_path)
        .map_err(wrap_io(&command_path))?;
    let cmd_line = picker_command(exe_str);
    cmd_key
        .set_value("", &cmd_line)
        .map_err(wrap_io(&command_path))?;

    Ok(())
}

pub fn register(exe: &Path) -> AppResult<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    register_for_root(&hkcu, exe)?;
    log::info!("shell integration: Windows registry entries written");
    Ok(())
}

fn register_for_root(hkcu: &RegKey, exe: &Path) -> AppResult<()> {
    let exe_str = exe.to_string_lossy().into_owned();
    let icon = format!("{exe_str},0");

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
        assoc_key
            .set_value("MultiSelectModel", &MULTI_SELECT_MODEL)
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
            verb_key
                .set_value("MultiSelectModel", &selection_model(t))
                .map_err(wrap_io(&verb_path))?;

            let command_path = format!(r"{verb_path}\command");
            let (cmd_key, _) = hkcu
                .create_subkey(&command_path)
                .map_err(wrap_io(&command_path))?;
            let cmd_line = tool_command(&exe_str, t.id);
            cmd_key
                .set_value("", &cmd_line)
                .map_err(wrap_io(&command_path))?;
        }
    }

    register_picker_fallback(hkcu, &exe_str, &icon)
}

pub fn unregister() -> AppResult<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    unregister_for_root(&hkcu)?;
    log::info!("shell integration: Windows registry entries removed");
    Ok(())
}

fn unregister_for_root(hkcu: &RegKey) -> AppResult<()> {
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

    Ok(())
}

fn key_exists(hkcu: &RegKey, path: &str) -> bool {
    hkcu.open_subkey(path).is_ok()
}

fn value_matches(hkcu: &RegKey, path: &str, name: &str, expected: &str) -> bool {
    hkcu.open_subkey(path)
        .and_then(|key| key.get_value::<String, _>(name))
        .is_ok_and(|actual| actual.eq_ignore_ascii_case(expected))
}

pub fn status(exe: &Path) -> RegistrationStatus {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    status_for_root(&hkcu, exe)
}

fn status_for_root(hkcu: &RegKey, exe: &Path) -> RegistrationStatus {
    let extension_paths = tools::all_extensions()
        .into_iter()
        .map(|ext| {
            (
                ext,
                format!(r"Software\Classes\SystemFileAssociations\.{ext}\shell\{SUBMENU_KEY}"),
            )
        })
        .collect::<Vec<_>>();

    let picker_exists = key_exists(hkcu, PICKER_KEY_PATH);
    let any_extension_exists = extension_paths
        .iter()
        .any(|(_, path)| key_exists(hkcu, path));
    if !picker_exists && !any_extension_exists {
        return RegistrationStatus::Missing;
    }

    if !picker_exists
        || !value_matches(
            hkcu,
            PICKER_KEY_PATH,
            "MultiSelectModel",
            MULTI_SELECT_MODEL,
        )
        || !value_matches(
            hkcu,
            &format!(r"{PICKER_KEY_PATH}\command"),
            "",
            &picker_command(&exe.to_string_lossy()),
        )
    {
        return RegistrationStatus::NeedsRepair;
    }

    let exe = exe.to_string_lossy();
    for (ext, assoc_path) in extension_paths {
        if !value_matches(hkcu, &assoc_path, "MultiSelectModel", MULTI_SELECT_MODEL) {
            return RegistrationStatus::NeedsRepair;
        }

        for tool in tools::tools()
            .iter()
            .filter(|tool| tool.extensions.contains(&ext))
        {
            let verb_path = format!(r"{assoc_path}\shell\{}", tool.id);
            let command_path = format!(r"{verb_path}\command");
            if !value_matches(hkcu, &verb_path, "MultiSelectModel", selection_model(tool))
                || !value_matches(hkcu, &command_path, "", &tool_command(&exe, tool.id))
            {
                return RegistrationStatus::NeedsRepair;
            }
        }
    }

    RegistrationStatus::Active
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commands_quote_the_executable_and_selected_files() {
        let exe = r"C:\Program Files\OpenExpress\openexpress.exe";
        assert_eq!(
            picker_command(exe),
            r#""C:\Program Files\OpenExpress\openexpress.exe" "%1""#
        );
        assert_eq!(
            tool_command(exe, "image-resize"),
            r#""C:\Program Files\OpenExpress\openexpress.exe" --tool image-resize "%1""#
        );
    }

    #[test]
    fn registration_status_detects_active_stale_and_missing_entries() {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let test_path = format!(
            r"Software\OpenExpress\Tests\shell-integration-{}",
            std::process::id()
        );
        let _ = hkcu.delete_subkey_all(&test_path);
        let (test_root, _) = hkcu.create_subkey(&test_path).unwrap();
        let exe = Path::new(r"C:\Program Files\OpenExpress\openexpress.exe");

        register_for_root(&test_root, exe).unwrap();
        assert_eq!(status_for_root(&test_root, exe), RegistrationStatus::Active);

        let command_path = format!(r"{PICKER_KEY_PATH}\command");
        let command_key = test_root
            .open_subkey_with_flags(command_path, KEY_WRITE)
            .unwrap();
        command_key
            .set_value("", &r#""C:\Old\openexpress.exe" "%1""#)
            .unwrap();
        assert_eq!(
            status_for_root(&test_root, exe),
            RegistrationStatus::NeedsRepair
        );
        drop(command_key);

        unregister_for_root(&test_root).unwrap();
        assert_eq!(
            status_for_root(&test_root, exe),
            RegistrationStatus::Missing
        );
        drop(test_root);
        hkcu.delete_subkey_all(&test_path).unwrap();
    }
}
