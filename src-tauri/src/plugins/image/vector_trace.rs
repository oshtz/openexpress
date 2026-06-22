use crate::{AppError, AppResult};
use serde::Serialize;
use std::path::Path;
use vtracer::{ColorMode, Config, Hierarchical};

#[derive(Debug, Serialize)]
pub struct VectorTraceResult {
    pub output_path: String,
    pub file_size: u64,
}

/// Trace a raster image into an SVG. `color_mode` chooses full-color
/// stacked layers vs. binary (1-bit) output. `detail` is the filter_speckle
/// knob — lower keeps more small features at the cost of larger SVGs.
#[tauri::command]
pub async fn vector_trace_image(
    input_path: String,
    output_path: String,
    color_mode: String,
    detail: u32,
) -> AppResult<VectorTraceResult> {
    let mode = match color_mode.as_str() {
        "color" => ColorMode::Color,
        "binary" => ColorMode::Binary,
        other => {
            return Err(AppError::InvalidInput(format!(
                "color_mode must be 'color' or 'binary' (got '{other}')"
            )));
        }
    };

    if !(1..=20).contains(&detail) {
        return Err(AppError::InvalidInput(format!(
            "detail must be in [1, 20] (got {detail})"
        )));
    }

    let config = Config {
        color_mode: mode,
        hierarchical: Hierarchical::Stacked,
        filter_speckle: detail as usize,
        ..Config::default()
    };

    // vtracer reads the file itself; it returns plain-string errors which we
    // remap into a typed Internal error to keep the boundary contract.
    vtracer::convert_image_to_svg(Path::new(&input_path), Path::new(&output_path), config)
        .map_err(|e| AppError::Internal(format!("vtracer: {e}")))?;

    let metadata =
        std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(VectorTraceResult {
        output_path,
        file_size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[tokio::test]
    async fn trace_simple_image_writes_svg() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.svg");
        // 32×32 two-color quadrants — small enough for fast tracing,
        // big enough to produce shapes.
        let mut img = ImageBuffer::new(32u32, 32u32);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = if x < 16 && y < 16 {
                Rgba([255u8, 0, 0, 255])
            } else {
                Rgba([0u8, 0, 255, 255])
            };
        }
        img.save(&input).unwrap();

        let result = vector_trace_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            "color".into(),
            4,
        )
        .await
        .unwrap();

        assert!(std::path::Path::new(&result.output_path).exists());
        let contents = std::fs::read_to_string(&result.output_path).unwrap();
        assert!(contents.contains("<svg"));
    }

    #[tokio::test]
    async fn rejects_unknown_color_mode() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.png");
        let output = dir.path().join("out.svg");
        ImageBuffer::from_pixel(8u32, 8u32, Rgba([0u8, 0, 0, 255]))
            .save(&input)
            .unwrap();

        let err = vector_trace_image(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            "purple".into(),
            4,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
