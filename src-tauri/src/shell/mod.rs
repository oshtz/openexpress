//! OS-level shell integration: registers OpenExpress quick-actions in the
//! file-manager right-click menu (Explorer / Finder).
//!
//! Strategy by platform:
//! - **Windows** runtime: cascading submenu via the per-user registry under
//!   `HKCU\Software\Classes\SystemFileAssociations\<ext>\shell\OpenExpress`,
//!   with sub-commands defined in `HKCU\Software\Classes\CommandStore\shell`.
//! - **macOS**: services are baked into the bundle's Info.plist at build
//!   time, so the runtime toggle is a no-op there. The Settings panel
//!   explains this.

pub mod tools;

#[cfg(target_os = "windows")]
mod windows;

use crate::AppResult;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ShellIntegrationStatus {
    /// True when at least one tool's shell entry is currently registered.
    pub installed: bool,
    /// Set when the running platform doesn't support runtime register/unregister.
    pub manual_only: bool,
    /// Optional explanatory note shown in the Settings panel.
    pub note: Option<String>,
}

#[tauri::command]
pub async fn shell_integration_status() -> AppResult<ShellIntegrationStatus> {
    #[cfg(target_os = "windows")]
    {
        Ok(ShellIntegrationStatus {
            installed: windows::is_installed(),
            manual_only: false,
            note: Some(
                "Windows 11 may show custom shell verbs under 'Show more options' in the classic context menu."
                    .into(),
            ),
        })
    }
    #[cfg(target_os = "macos")]
    {
        Ok(ShellIntegrationStatus {
            installed: true,
            manual_only: true,
            note: Some(
                "macOS Services are bundled with the app. Look for OpenExpress \
                 entries under the 'Services' submenu when right-clicking a file."
                    .into(),
            ),
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(ShellIntegrationStatus {
            installed: false,
            manual_only: true,
            note: Some("Shell integration is not supported on this platform.".into()),
        })
    }
}

#[tauri::command]
pub async fn register_shell_integration() -> AppResult<()> {
    let exe = std::env::current_exe()
        .map_err(|e| crate::AppError::Internal(format!("locating own exe: {e}")))?;
    #[cfg(target_os = "windows")]
    {
        windows::register(&exe)
    }
    #[cfg(target_os = "macos")]
    {
        let _ = exe;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = exe;
        Err(crate::AppError::FeatureDisabled(
            "shell integration unsupported on this platform".into(),
        ))
    }
}

#[tauri::command]
pub async fn unregister_shell_integration() -> AppResult<()> {
    #[cfg(target_os = "windows")]
    {
        windows::unregister()
    }
    #[cfg(target_os = "macos")]
    {
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err(crate::AppError::FeatureDisabled(
            "shell integration unsupported on this platform".into(),
        ))
    }
}
