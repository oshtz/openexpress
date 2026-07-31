//! OS-level shell integration: registers OpenExpress quick-actions in the
//! file-manager right-click menu (Explorer / Finder).
//!
//! Strategy by platform:
//! - **Windows** runtime: cascading submenu via the per-user registry under
//!   `HKCU\Software\Classes\SystemFileAssociations\<ext>\shell\OpenExpress`,
//!   plus a generic picker verb for mixed selections.
//! - **macOS**: one type-filtered Service is baked into the bundle's
//!   Info.plist, so the runtime toggle is a no-op there.

pub mod tools;

#[cfg(target_os = "windows")]
mod windows;

use crate::AppResult;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ShellIntegrationStatus {
    /// True when OpenExpress-owned shell entries exist, including stale ones.
    pub installed: bool,
    /// True when entries exist but do not match the running executable or
    /// current registration shape.
    pub needs_repair: bool,
    /// Set when the running platform doesn't support runtime register/unregister.
    pub manual_only: bool,
    /// Optional explanatory note shown in the Settings panel.
    pub note: Option<String>,
}

#[tauri::command]
pub async fn shell_integration_status() -> AppResult<ShellIntegrationStatus> {
    #[cfg(target_os = "windows")]
    {
        let exe = std::env::current_exe()
            .map_err(|e| crate::AppError::Internal(format!("locating own exe: {e}")))?;
        let status = windows::status(&exe);
        Ok(ShellIntegrationStatus {
            installed: status != windows::RegistrationStatus::Missing,
            needs_repair: status == windows::RegistrationStatus::NeedsRepair,
            manual_only: false,
            note: Some(
                "Windows 11 shows this integration under 'Show more options' in the classic context menu."
                    .into(),
            ),
        })
    }
    #[cfg(target_os = "macos")]
    {
        Ok(ShellIntegrationStatus {
            installed: true,
            needs_repair: false,
            manual_only: true,
            note: Some("Use 'Open with OpenExpress' under Finder's Services submenu.".into()),
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(ShellIntegrationStatus {
            installed: false,
            needs_repair: false,
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
