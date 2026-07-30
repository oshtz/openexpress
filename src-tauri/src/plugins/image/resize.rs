use crate::output::write_output;
use crate::{AppError, AppResult};
use image::imageops::FilterType;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ResizeResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
}

#[tauri::command]
pub async fn resize_image(
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    maintain_aspect: bool,
) -> AppResult<ResizeResult> {
    if width == 0 || height == 0 {
        return Err(AppError::InvalidInput(
            "width and height must be greater than 0".into(),
        ));
    }

    let img = image::open(&input_path)?;

    let resized = if maintain_aspect {
        img.resize(width, height, FilterType::Lanczos3)
    } else {
        img.resize_exact(width, height, FilterType::Lanczos3)
    };

    let (final_w, final_h) = (resized.width(), resized.height());
    let output_path = write_output(output_path, |path| {
        resized.save(path)?;
        Ok(())
    })?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(ResizeResult {
        output_path,
        width: final_w,
        height: final_h,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    fn write_test_png(path: &std::path::Path, w: u32, h: u32) {
        let img = ImageBuffer::from_pixel(w, h, Rgba([255u8, 0, 0, 255]));
        img.save(path).unwrap();
    }

    #[tokio::test]
    async fn resize_exact_changes_dims() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        write_test_png(&input, 200, 100);

        let result = resize_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            50,
            50,
            false,
        )
        .await
        .unwrap();

        assert_eq!(result.width, 50);
        assert_eq!(result.height, 50);
        assert!(result.file_size > 0);
    }

    #[tokio::test]
    async fn resize_maintain_aspect_keeps_ratio() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        write_test_png(&input, 200, 100); // 2:1

        let result = resize_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            100,
            100,
            true,
        )
        .await
        .unwrap();

        // 2:1 ratio fitting into 100x100 → 100x50
        assert_eq!(result.width, 100);
        assert_eq!(result.height, 50);
    }

    #[tokio::test]
    async fn resize_missing_input_errors() {
        let result = resize_image(
            "C:\\does\\not\\exist.png".to_string(),
            "C:\\out.png".to_string(),
            50,
            50,
            false,
        )
        .await;
        assert!(result.is_err());
    }
}
