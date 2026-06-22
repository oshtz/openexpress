use crate::{AppError, AppResult};
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct CompressResult {
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub savings_percent: f32,
}

#[tauri::command]
pub async fn compress_image(
    input_path: String,
    output_path: String,
    quality: u8,
) -> AppResult<CompressResult> {
    if !(1..=100).contains(&quality) {
        return Err(AppError::InvalidInput(format!(
            "quality must be between 1 and 100 (got {quality})"
        )));
    }

    let original_size = fs::metadata(&input_path)
        .map_err(|e| AppError::from_io(e, &input_path))?
        .len();

    let img = image::open(&input_path)?;

    let ext = Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" => {
            let file =
                fs::File::create(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(file, quality);
            encoder.encode_image(&img)?;
        }
        _ => {
            img.save(&output_path)?;
        }
    }

    let compressed_size = fs::metadata(&output_path)
        .map_err(|e| AppError::from_io(e, &output_path))?
        .len();

    let savings_percent = if original_size > 0 {
        (1.0 - (compressed_size as f32 / original_size as f32)) * 100.0
    } else {
        0.0
    };

    Ok(CompressResult {
        output_path,
        original_size,
        compressed_size,
        savings_percent,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[tokio::test]
    async fn compress_low_quality_jpg_is_smaller() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.jpg");

        // 256×256 of structured noise so the JPEG encoder has something to compress
        let mut buf = ImageBuffer::new(256, 256);
        for (x, y, pixel) in buf.enumerate_pixels_mut() {
            *pixel = Rgba([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8, 255]);
        }
        buf.save(&input).unwrap();
        let original_png_size = std::fs::metadata(&input).unwrap().len();

        let result = compress_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            30,
        )
        .await
        .unwrap();

        assert_eq!(result.original_size, original_png_size);
        // Quality 30 JPEG should be smaller than the equivalent PNG for this synthetic
        // data — verify the savings calculation reflects that.
        assert!(result.compressed_size < result.original_size);
        assert!(result.savings_percent > 0.0);
    }
}
