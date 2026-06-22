use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RotateResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
}

#[tauri::command]
pub async fn rotate_flip_image(
    input_path: String,
    output_path: String,
    rotation: i32,
    flip_horizontal: bool,
    flip_vertical: bool,
) -> AppResult<RotateResult> {
    if !matches!(rotation, 0 | 90 | 180 | 270) {
        return Err(AppError::InvalidInput(format!(
            "rotation must be 0, 90, 180, or 270 (got {rotation})"
        )));
    }

    let mut img = image::open(&input_path)?;

    img = match rotation {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => img,
    };

    if flip_horizontal {
        img = img.fliph();
    }
    if flip_vertical {
        img = img.flipv();
    }

    let (w, h) = (img.width(), img.height());
    img.save(&output_path)?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(RotateResult {
        output_path,
        width: w,
        height: h,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[tokio::test]
    async fn rotate_90_swaps_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(200u32, 100u32, Rgba([0u8, 255, 0, 255]))
            .save(&input)
            .unwrap();

        let result = rotate_flip_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            90,
            false,
            false,
        )
        .await
        .unwrap();

        assert_eq!(result.width, 100);
        assert_eq!(result.height, 200);
    }

    #[tokio::test]
    async fn rotate_180_preserves_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(200u32, 100u32, Rgba([0u8, 0, 255, 255]))
            .save(&input)
            .unwrap();

        let result = rotate_flip_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            180,
            false,
            false,
        )
        .await
        .unwrap();

        assert_eq!(result.width, 200);
        assert_eq!(result.height, 100);
    }

    #[tokio::test]
    async fn flip_horizontal_preserves_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(150u32, 75u32, Rgba([200u8, 200, 0, 255]))
            .save(&input)
            .unwrap();

        let result = rotate_flip_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            0,
            true,
            false,
        )
        .await
        .unwrap();

        assert_eq!(result.width, 150);
        assert_eq!(result.height, 75);
    }
}
