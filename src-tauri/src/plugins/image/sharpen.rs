use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SharpenResult {
    pub output_path: String,
    pub file_size: u64,
}

/// Sharpen an image using an unsharp mask. `sigma` controls the blur radius
/// of the mask (larger = more aggressive sharpening); `threshold` skips
/// pixels whose neighborhood difference is below it (0 = sharpen everything,
/// higher = leave smooth regions alone, useful for skin).
#[tauri::command]
pub async fn sharpen_image(
    input_path: String,
    output_path: String,
    sigma: f32,
    threshold: i32,
) -> AppResult<SharpenResult> {
    if !(0.1..=20.0).contains(&sigma) {
        return Err(AppError::InvalidInput(format!(
            "sigma must be in [0.1, 20.0] (got {sigma})"
        )));
    }
    if !(0..=255).contains(&threshold) {
        return Err(AppError::InvalidInput(format!(
            "threshold must be in [0, 255] (got {threshold})"
        )));
    }

    let img = image::open(&input_path)?;
    let sharpened = img.unsharpen(sigma, threshold);
    sharpened.save(&output_path)?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(SharpenResult {
        output_path,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, ImageBuffer, Rgba};

    #[tokio::test]
    async fn sharpen_preserves_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(40u32, 30u32, Rgba([100u8, 120, 140, 255]))
            .save(&input)
            .unwrap();

        let result = sharpen_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            1.5,
            0,
        )
        .await
        .unwrap();

        let reloaded = image::open(&result.output_path).unwrap();
        assert_eq!(reloaded.dimensions(), (40, 30));
    }

    #[tokio::test]
    async fn rejects_invalid_sigma() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(10u32, 10u32, Rgba([0u8, 0, 0, 255]))
            .save(&input)
            .unwrap();

        let err = sharpen_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            -1.0,
            0,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
