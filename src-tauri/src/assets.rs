use crate::{AppError, AppResult};
use std::path::{Path, PathBuf};
use tauri::Manager;

fn validate_asset_path(path: &Path) -> AppResult<()> {
    let metadata = std::fs::metadata(path)
        .map_err(|error| AppError::from_io(error, path.to_string_lossy()))?;
    if !metadata.is_file() {
        return Err(AppError::InvalidInput(format!(
            "Asset path is not a file: {}",
            path.display()
        )));
    }
    Ok(())
}

#[tauri::command]
pub fn allow_asset_paths(app: tauri::AppHandle, paths: Vec<String>) -> AppResult<()> {
    for raw_path in paths {
        let path = PathBuf::from(raw_path);
        validate_asset_path(&path)?;
        app.asset_protocol_scope()
            .allow_file(&path)
            .map_err(|error| AppError::Internal(format!("authorizing asset path: {error}")))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_asset_path;

    #[test]
    fn accepts_files_and_rejects_directories() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("image.png");
        std::fs::write(&file, b"png").unwrap();

        assert!(validate_asset_path(&file).is_ok());
        assert!(validate_asset_path(dir.path()).is_err());
    }
}
