use crate::output::write_output;
use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BlurResult {
    pub output_path: String,
    pub file_size: u64,
}

/// Gaussian blur. `sigma` is the standard deviation of the kernel — larger
/// values produce a heavier blur. Range chosen for UI sliders: 0.5–20.
#[tauri::command]
pub async fn blur_image(
    input_path: String,
    output_path: String,
    sigma: f32,
) -> AppResult<BlurResult> {
    if !(0.1..=50.0).contains(&sigma) {
        return Err(AppError::InvalidInput(format!(
            "sigma must be in [0.1, 50.0] (got {sigma})"
        )));
    }

    let img = image::open(&input_path)?;
    let blurred = img.blur(sigma);
    let output_path = write_output(output_path, |path| {
        blurred.save(path)?;
        Ok(())
    })?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(BlurResult {
        output_path,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, ImageBuffer, Rgba};

    #[tokio::test]
    async fn blur_preserves_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(50u32, 25u32, Rgba([200u8, 100, 50, 255]))
            .save(&input)
            .unwrap();

        let result = blur_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            2.0,
        )
        .await
        .unwrap();

        let reloaded = image::open(&result.output_path).unwrap();
        assert_eq!(reloaded.dimensions(), (50, 25));
    }

    #[tokio::test]
    async fn rejects_invalid_sigma() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(8u32, 8u32, Rgba([0u8, 0, 0, 255]))
            .save(&input)
            .unwrap();

        let err = blur_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            0.0,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
