use crate::output::write_output;
use crate::{AppError, AppResult};
use image::DynamicImage;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AdjustResult {
    pub output_path: String,
    pub file_size: u64,
}

#[tauri::command]
pub async fn adjust_image(
    input_path: String,
    output_path: String,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) -> AppResult<AdjustResult> {
    for (name, value) in [
        ("brightness", brightness),
        ("contrast", contrast),
        ("saturation", saturation),
    ] {
        if !(-100.0..=100.0).contains(&value) {
            return Err(AppError::InvalidInput(format!(
                "{name} must be in [-100, 100] (got {value})"
            )));
        }
    }

    let img = image::open(&input_path)?;

    let adjusted = apply_adjustments(&img, brightness, contrast, saturation);
    let output_path = write_output(output_path, |path| {
        adjusted.save(path)?;
        Ok(())
    })?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(AdjustResult {
        output_path,
        file_size: metadata.len(),
    })
}

fn apply_adjustments(
    img: &DynamicImage,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) -> DynamicImage {
    // Compute coefficients once (they're per-image, not per-pixel).
    let bright_offset = brightness * 2.55;
    let contrast_factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
    let sat_factor = (saturation + 100.0) / 100.0;

    let mut rgba = img.to_rgba8();
    for px in rgba.chunks_exact_mut(4) {
        let mut rf = px[0] as f32 + bright_offset;
        let mut gf = px[1] as f32 + bright_offset;
        let mut bf = px[2] as f32 + bright_offset;

        rf = contrast_factor * (rf - 128.0) + 128.0;
        gf = contrast_factor * (gf - 128.0) + 128.0;
        bf = contrast_factor * (bf - 128.0) + 128.0;

        let lum = 0.299 * rf + 0.587 * gf + 0.114 * bf;
        rf = lum + sat_factor * (rf - lum);
        gf = lum + sat_factor * (gf - lum);
        bf = lum + sat_factor * (bf - lum);

        px[0] = rf.clamp(0.0, 255.0) as u8;
        px[1] = gf.clamp(0.0, 255.0) as u8;
        px[2] = bf.clamp(0.0, 255.0) as u8;
        // Alpha (px[3]) is preserved.
    }

    DynamicImage::ImageRgba8(rgba)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, ImageBuffer, Rgba};

    #[tokio::test]
    async fn zero_adjustment_preserves_dimensions() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        ImageBuffer::from_pixel(40u32, 30u32, Rgba([120u8, 130, 140, 255]))
            .save(&input)
            .unwrap();

        let result = adjust_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            0.0,
            0.0,
            0.0,
        )
        .await
        .unwrap();

        let reloaded = image::open(&result.output_path).unwrap();
        assert_eq!(reloaded.dimensions(), (40, 30));
    }

    #[tokio::test]
    async fn positive_brightness_pushes_pixels_up() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.png");
        // Mid-grey input
        ImageBuffer::from_pixel(8u32, 8u32, Rgba([100u8, 100, 100, 255]))
            .save(&input)
            .unwrap();

        adjust_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            50.0,
            0.0,
            0.0,
        )
        .await
        .unwrap();

        let reloaded = image::open(&output).unwrap();
        let pixel = reloaded.to_rgba8().get_pixel(0, 0).0;
        assert!(
            pixel[0] > 100,
            "expected brightness boost, got {}",
            pixel[0]
        );
    }
}
