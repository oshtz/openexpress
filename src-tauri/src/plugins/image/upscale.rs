//! AI image upscale via Real-ESRGAN x4plus ONNX.
//!
//! Model: `realesrgan_x4plus` (~67 MB, BSD-3). Auto-downloaded on first
//! use to `<app_data>/models/realesrgan_x4plus.onnx`. Input is normalized
//! to [0,1] RGB; inputs larger than 1024 px on either side are fitted to that
//! max axis before inference. No ImageNet normalization.
//!
//! Currently supports `scale=4` only. A future round can add a smaller x2
//! model (realesr-general-x2v3) for faster output.
//!
//! Gated behind the `ai-upscale` cargo feature.

#[cfg(feature = "ai-upscale")]
use crate::output::write_output;
use crate::{AppError, AppResult};
use serde::Serialize;

#[cfg(feature = "ai-upscale")]
const MAX_NON_TILED_DIMENSION: u32 = 1024;
#[cfg(feature = "ai-upscale")]
const FALLBACK_TILE_DIMENSION: u32 = 128;

#[derive(Debug, Serialize)]
pub struct UpscaleResult {
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub original_width: u32,
    pub original_height: u32,
    pub model_input_width: u32,
    pub model_input_height: u32,
    pub auto_fit: bool,
}

#[cfg(any(feature = "ai-upscale", test))]
fn fit_to_max_axis(width: u32, height: u32, max_axis: u32) -> (u32, u32, bool) {
    if width == 0 || height == 0 || max_axis == 0 {
        return (width, height, false);
    }

    let largest = width.max(height);
    if largest <= max_axis {
        return (width, height, false);
    }

    let ratio = max_axis as f64 / largest as f64;
    let fitted_width = ((width as f64) * ratio).round().max(1.0) as u32;
    let fitted_height = ((height as f64) * ratio).round().max(1.0) as u32;
    (fitted_width, fitted_height, true)
}

#[cfg(any(feature = "ai-upscale", test))]
fn padded_tile_dimension(dimension: u32, tile_size: u32) -> u32 {
    if tile_size == 0 {
        return dimension;
    }

    dimension.max(1).div_ceil(tile_size) * tile_size
}

#[cfg(any(feature = "ai-upscale", test))]
fn edge_padded_canvas(source: &image::RgbImage, tile_size: u32) -> image::RgbImage {
    let (width, height) = source.dimensions();
    if width == 0 || height == 0 {
        return image::RgbImage::new(width, height);
    }

    let padded_width = padded_tile_dimension(width, tile_size);
    let padded_height = padded_tile_dimension(height, tile_size);
    image::RgbImage::from_fn(padded_width, padded_height, |x, y| {
        *source.get_pixel(x.min(width - 1), y.min(height - 1))
    })
}

#[cfg(any(feature = "ai-upscale", test))]
fn fixed_square_tile_size_from_shape(shape: &[i64]) -> Option<u32> {
    if shape.len() != 4 || shape[1] != 3 || shape[2] <= 0 || shape[2] != shape[3] {
        return None;
    }

    u32::try_from(shape[2]).ok()
}

#[tauri::command]
pub async fn upscale_image(
    _app: tauri::AppHandle,
    _input_path: String,
    _output_path: String,
    _scale: u32,
) -> AppResult<UpscaleResult> {
    #[cfg(feature = "ai-upscale")]
    {
        impl_upscale_image(_app, _input_path, _output_path, _scale).await
    }
    #[cfg(not(feature = "ai-upscale"))]
    {
        Err(AppError::FeatureDisabled(
            "AI upscale is not enabled in this build. Rebuild with \
             `cargo tauri build --features ai-upscale`."
                .into(),
        ))
    }
}

#[cfg(feature = "ai-upscale")]
async fn impl_upscale_image(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
    scale: u32,
) -> AppResult<UpscaleResult> {
    use crate::plugins::models;

    if scale != 4 {
        return Err(AppError::InvalidInput(format!(
            "scale {scale} not supported yet; only 4 is wired (Real-ESRGAN x4plus). \
             An x2 model can be added in a future build."
        )));
    }

    const MODEL_ID: &str = "realesrgan_x4plus";

    if !models::is_present(&app, MODEL_ID) {
        return Err(AppError::FeatureDisabled(format!(
            "Model '{MODEL_ID}' is not installed. Call `download_model('{MODEL_ID}')` first."
        )));
    }
    let model_path = models::model_path(&app, MODEL_ID)?;

    tokio::task::spawn_blocking(move || {
        upscale_image_with_model_path(&input_path, &output_path, scale, &model_path)
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))?
}

#[cfg(feature = "ai-upscale")]
fn upscale_image_with_model_path(
    input_path: &str,
    output_path: &str,
    scale: u32,
    model_path: &std::path::Path,
) -> AppResult<UpscaleResult> {
    use image::{imageops, imageops::FilterType, GenericImageView, ImageBuffer, Rgb};
    use ndarray::Array4;
    use ort::session::{builder::GraphOptimizationLevel, Session};
    use ort::value::TensorRef;

    if scale != 4 {
        return Err(AppError::InvalidInput(format!(
            "scale {scale} not supported yet; only 4 is wired (Real-ESRGAN x4plus). \
             An x2 model can be added in a future build."
        )));
    }

    let original = image::open(input_path)?;
    let (ow, oh) = original.dimensions();
    let (model_w, model_h, auto_fit) = fit_to_max_axis(ow, oh, MAX_NON_TILED_DIMENSION);
    let prepared = if auto_fit {
        original.resize_exact(model_w, model_h, FilterType::Lanczos3)
    } else {
        original
    };

    let rgb = prepared.to_rgb8();

    let mut session = Session::builder()
        .map_err(|e| AppError::Internal(format!("ort builder: {e}")))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| AppError::Internal(format!("ort opt: {e}")))?
        .commit_from_file(model_path)
        .map_err(|e| AppError::Internal(format!("loading model: {e}")))?;

    let input_name = session
        .inputs()
        .first()
        .ok_or_else(|| AppError::Internal("model has no inputs".into()))?
        .name()
        .to_string();
    let tile_size = session
        .inputs()
        .first()
        .and_then(|input| input.dtype().tensor_shape())
        .and_then(|shape| fixed_square_tile_size_from_shape(shape))
        .unwrap_or(FALLBACK_TILE_DIMENSION);
    let tile_size_usize = tile_size as usize;

    let padded = edge_padded_canvas(&rgb, tile_size);
    let (padded_w, padded_h) = padded.dimensions();
    let expected_tile_output = tile_size * scale;
    let mut padded_out: ImageBuffer<Rgb<u8>, Vec<u8>> =
        ImageBuffer::new(padded_w * scale, padded_h * scale);

    for tile_y in (0..padded_h).step_by(tile_size_usize) {
        for tile_x in (0..padded_w).step_by(tile_size_usize) {
            let mut input = Array4::<f32>::zeros((1, 3, tile_size_usize, tile_size_usize));
            for y in 0..tile_size_usize {
                for x in 0..tile_size_usize {
                    let px = padded.get_pixel(tile_x + x as u32, tile_y + y as u32);
                    input[[0, 0, y, x]] = px.0[0] as f32 / 255.0;
                    input[[0, 1, y, x]] = px.0[1] as f32 / 255.0;
                    input[[0, 2, y, x]] = px.0[2] as f32 / 255.0;
                }
            }

            let shape_dims = [1usize, 3, tile_size_usize, tile_size_usize];
            let input_slice = input
                .as_slice()
                .ok_or_else(|| AppError::Internal("input not contiguous".into()))?;
            let input_tensor = TensorRef::from_array_view((shape_dims, input_slice))
                .map_err(|e| AppError::Internal(format!("tensor view: {e}")))?;

            let outputs = session
                .run(ort::inputs![input_name.as_str() => input_tensor])
                .map_err(|e| AppError::Internal(format!("inference: {e}")))?;

            let first_key = outputs
                .keys()
                .next()
                .ok_or_else(|| AppError::Internal("no model outputs".into()))?
                .to_string();
            let raw = outputs[first_key.as_str()]
                .try_extract_array::<f32>()
                .map_err(|e| AppError::Internal(format!("output extract: {e}")))?;
            let shape = raw.shape().to_vec();
            if shape.len() != 4
                || shape[1] != 3
                || shape[2] as u32 != expected_tile_output
                || shape[3] as u32 != expected_tile_output
            {
                return Err(AppError::Internal(format!(
                    "unexpected output shape {shape:?}, want [1, 3, {expected_tile_output}, {expected_tile_output}]"
                )));
            }

            let dst_x = tile_x * scale;
            let dst_y = tile_y * scale;
            for y in 0..expected_tile_output as usize {
                for x in 0..expected_tile_output as usize {
                    let r = (raw[[0, 0, y, x]].clamp(0.0, 1.0) * 255.0).round() as u8;
                    let g = (raw[[0, 1, y, x]].clamp(0.0, 1.0) * 255.0).round() as u8;
                    let b = (raw[[0, 2, y, x]].clamp(0.0, 1.0) * 255.0).round() as u8;
                    padded_out.put_pixel(dst_x + x as u32, dst_y + y as u32, Rgb([r, g, b]));
                }
            }
        }
    }

    let out_w = model_w * scale;
    let out_h = model_h * scale;
    let out = imageops::crop_imm(&padded_out, 0, 0, out_w, out_h).to_image();
    let output_path = write_output(output_path, |path| {
        out.save(path)?;
        Ok(())
    })?;

    let meta = std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(UpscaleResult {
        output_path,
        width: out_w,
        height: out_h,
        file_size: meta.len(),
        original_width: ow,
        original_height: oh,
        model_input_width: model_w,
        model_input_height: model_h,
        auto_fit,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_to_max_axis_preserves_aspect_ratio_for_tall_images() {
        assert_eq!(fit_to_max_axis(800, 1311, 1024), (625, 1024, true));
    }

    #[test]
    fn fit_to_max_axis_preserves_aspect_ratio_for_wide_images() {
        assert_eq!(fit_to_max_axis(2400, 900, 1024), (1024, 384, true));
    }

    #[test]
    fn fit_to_max_axis_keeps_small_images_unchanged() {
        assert_eq!(fit_to_max_axis(640, 480, 1024), (640, 480, false));
    }

    #[test]
    fn padded_tile_dimension_covers_partial_tiles() {
        assert_eq!(padded_tile_dimension(625, 128), 640);
        assert_eq!(padded_tile_dimension(1024, 128), 1024);
    }

    #[test]
    fn padded_tile_dimension_never_drops_below_one_tile() {
        assert_eq!(padded_tile_dimension(1, 128), 128);
    }

    #[test]
    fn edge_padded_canvas_extends_border_pixels() {
        let source = image::RgbImage::from_fn(2, 1, |x, _| {
            if x == 0 {
                image::Rgb([10, 20, 30])
            } else {
                image::Rgb([200, 210, 220])
            }
        });

        let padded = edge_padded_canvas(&source, 4);

        assert_eq!(padded.dimensions(), (4, 4));
        assert_eq!(*padded.get_pixel(0, 0), image::Rgb([10, 20, 30]));
        assert_eq!(*padded.get_pixel(3, 0), image::Rgb([200, 210, 220]));
        assert_eq!(*padded.get_pixel(3, 3), image::Rgb([200, 210, 220]));
    }

    #[test]
    fn fixed_square_tile_size_accepts_nchw_rgb_square_shape() {
        assert_eq!(
            fixed_square_tile_size_from_shape(&[1, 3, 128, 128]),
            Some(128)
        );
    }

    #[test]
    fn fixed_square_tile_size_rejects_dynamic_or_non_square_shapes() {
        assert_eq!(fixed_square_tile_size_from_shape(&[1, 3, -1, -1]), None);
        assert_eq!(fixed_square_tile_size_from_shape(&[1, 3, 128, 256]), None);
    }

    #[cfg(feature = "ai-upscale")]
    #[test]
    fn local_realesrgan_model_accepts_fixed_tile_tensor_when_installed(
    ) -> Result<(), Box<dyn std::error::Error>> {
        use ndarray::Array4;
        use ort::session::{builder::GraphOptimizationLevel, Session};
        use ort::value::TensorRef;
        use std::path::PathBuf;

        let Some(appdata) = std::env::var_os("APPDATA") else {
            return Ok(());
        };
        let model_path = PathBuf::from(appdata)
            .join("com.openexpress.desktop")
            .join("models")
            .join("real_esrgan_x4plus.onnx");
        if !model_path.exists()
            || !model_path
                .with_file_name("real_esrgan_x4plus.data")
                .exists()
        {
            return Ok(());
        }

        let mut session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .commit_from_file(&model_path)?;
        let input = session.inputs().first().expect("model has input");
        let input_name = input.name().to_string();
        let tile_size = input
            .dtype()
            .tensor_shape()
            .and_then(|shape| fixed_square_tile_size_from_shape(shape))
            .expect("fixed square RGB input shape");
        assert_eq!(tile_size, 128);

        let tile_size = tile_size as usize;
        let input = Array4::<f32>::zeros((1, 3, tile_size, tile_size));
        let input_slice = input.as_slice().expect("contiguous input");
        let input_tensor =
            TensorRef::from_array_view(([1usize, 3, tile_size, tile_size], input_slice))?;
        let outputs = session.run(ort::inputs![input_name.as_str() => input_tensor])?;
        let first_key = outputs.keys().next().expect("model has output").to_string();
        let raw = outputs[first_key.as_str()].try_extract_array::<f32>()?;

        assert_eq!(raw.shape(), &[1, 3, 512, 512]);
        Ok(())
    }

    #[cfg(feature = "ai-upscale")]
    #[test]
    fn local_realesrgan_upscale_runs_tiled_path_for_non_tile_multiple_image_when_installed(
    ) -> Result<(), Box<dyn std::error::Error>> {
        use image::GenericImageView;

        let Some(model_path) = local_realesrgan_model_path() else {
            return Ok(());
        };
        let dir = tempfile::tempdir()?;
        let input_path = dir.path().join("input.png");
        let output_path = dir.path().join("output.png");
        image::RgbImage::from_fn(129, 130, |x, y| {
            image::Rgb([(x % 255) as u8, (y % 255) as u8, ((x + y) % 255) as u8])
        })
        .save(&input_path)?;

        let result = upscale_image_with_model_path(
            input_path.to_string_lossy().as_ref(),
            output_path.to_string_lossy().as_ref(),
            4,
            &model_path,
        )?;

        assert_eq!((result.width, result.height), (516, 520));
        assert_eq!(image::open(output_path)?.dimensions(), (516, 520));
        Ok(())
    }

    #[cfg(feature = "ai-upscale")]
    fn local_realesrgan_model_path() -> Option<std::path::PathBuf> {
        let appdata = std::env::var_os("APPDATA")?;
        let model_path = std::path::PathBuf::from(appdata)
            .join("com.openexpress.desktop")
            .join("models")
            .join("real_esrgan_x4plus.onnx");
        let data_path = model_path.with_file_name("real_esrgan_x4plus.data");
        (model_path.exists() && data_path.exists()).then_some(model_path)
    }
}
