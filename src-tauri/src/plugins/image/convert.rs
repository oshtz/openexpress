use crate::output::write_output;
use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ConvertResult {
    pub output_path: String,
    pub format: String,
    pub file_size: u64,
}

#[tauri::command]
pub async fn convert_image(input_path: String, output_path: String) -> AppResult<ConvertResult> {
    let img = image::open(&input_path)?;

    let output_path = write_output(output_path, |path| {
        img.save(path)?;
        Ok(())
    })?;

    let format = std::path::Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_uppercase();

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(ConvertResult {
        output_path,
        format,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[tokio::test]
    async fn convert_png_to_jpg_produces_jpg() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.jpg");
        // JPEG doesn't support alpha, but image crate handles RGBA→RGB conversion.
        ImageBuffer::from_pixel(64u32, 64u32, Rgba([10u8, 100, 200, 255]))
            .save(&input)
            .unwrap();

        let result = convert_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
        )
        .await
        .unwrap();

        assert_eq!(result.format, "JPG");
        assert!(result.file_size > 0);

        // Round-trip: make sure the JPG is readable
        let reloaded = image::open(&output).unwrap();
        assert_eq!(reloaded.width(), 64);
        assert_eq!(reloaded.height(), 64);
    }
}
