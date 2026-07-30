use crate::output::write_output;
use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CropResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
}

#[tauri::command]
pub async fn crop_image(
    input_path: String,
    output_path: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> AppResult<CropResult> {
    if width == 0 || height == 0 {
        return Err(AppError::InvalidInput(
            "crop width and height must be greater than 0".into(),
        ));
    }

    let mut img = image::open(&input_path)?;

    let cropped = img.crop(x, y, width, height);
    let output_path = write_output(output_path, |path| {
        cropped.save(path)?;
        Ok(())
    })?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(CropResult {
        output_path,
        width: cropped.width(),
        height: cropped.height(),
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[tokio::test]
    async fn crop_subregion_has_requested_dims() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(200u32, 100u32, Rgba([255u8, 0, 0, 255]))
            .save(&input)
            .unwrap();

        let result = crop_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            10,
            10,
            50,
            40,
        )
        .await
        .unwrap();

        assert_eq!(result.width, 50);
        assert_eq!(result.height, 40);
    }

    #[tokio::test]
    async fn crop_missing_input_errors() {
        let result = crop_image(
            "C:\\nope.png".to_string(),
            "C:\\out.png".to_string(),
            0,
            0,
            10,
            10,
        )
        .await;
        assert!(result.is_err());
    }
}
