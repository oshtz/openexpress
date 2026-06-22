//! Background removal via the U-2-Net portable ONNX model.
//!
//! Model: `u2netp` (4.7 MB, Apache 2.0). Auto-downloaded on first use to
//! `<app_data>/models/u2netp.onnx`. Input is normalized to ImageNet stats
//! at 320x320; the [1,1,320,320] mask is resized back to source dims and
//! composited as the alpha channel of a PNG output.
//!
//! Gated behind the `bg-removal` cargo feature so the default build stays
//! free of `ort` (~200 MB native binaries).

use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RemoveBgResult {
    pub output_path: String,
    pub file_size: u64,
}

#[tauri::command]
pub async fn remove_background(
    _app: tauri::AppHandle,
    _input_path: String,
    _output_path: String,
) -> AppResult<RemoveBgResult> {
    #[cfg(feature = "bg-removal")]
    {
        impl_remove_background(_app, _input_path, _output_path).await
    }
    #[cfg(not(feature = "bg-removal"))]
    {
        Err(AppError::FeatureDisabled(
            "Background removal is not enabled in this build. Rebuild with \
             `cargo tauri build --features bg-removal`."
                .into(),
        ))
    }
}

#[cfg(feature = "bg-removal")]
async fn impl_remove_background(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
) -> AppResult<RemoveBgResult> {
    use crate::plugins::models;
    use image::{imageops::FilterType, GenericImageView, ImageBuffer, Rgba};
    use ndarray::{Array, Array4};
    use ort::session::{builder::GraphOptimizationLevel, Session};
    use ort::value::TensorRef;

    const MODEL_ID: &str = "u2netp";
    const SIZE: u32 = 320;
    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];

    if !models::is_present(&app, MODEL_ID) {
        return Err(AppError::FeatureDisabled(format!(
            "Model '{MODEL_ID}' is not installed. Call `download_model('{MODEL_ID}')` first."
        )));
    }
    let model_path = models::model_path(&app, MODEL_ID)?;

    // Heavy work on a blocking task — ort + image::open are sync.
    tokio::task::spawn_blocking(move || -> AppResult<RemoveBgResult> {
        let original = image::open(&input_path)?;
        let (ow, oh) = original.dimensions();

        // 1. Resize to model input, convert to RGB, normalize.
        let resized = original
            .resize_exact(SIZE, SIZE, FilterType::Triangle)
            .to_rgb8();
        let mut input = Array4::<f32>::zeros((1, 3, SIZE as usize, SIZE as usize));
        for (x, y, px) in resized.enumerate_pixels() {
            let (ux, uy) = (x as usize, y as usize);
            for c in 0..3 {
                let v = (px.0[c] as f32 / 255.0 - MEAN[c]) / STD[c];
                input[[0, c, uy, ux]] = v;
            }
        }

        // 2. Run inference.
        let mut session = Session::builder()
            .map_err(|e| AppError::Internal(format!("ort builder: {e}")))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| AppError::Internal(format!("ort opt: {e}")))?
            .commit_from_file(&model_path)
            .map_err(|e| AppError::Internal(format!("loading model: {e}")))?;

        let input_name = session
            .inputs()
            .first()
            .ok_or_else(|| AppError::Internal("model has no inputs".into()))?
            .name()
            .to_string();

        // Pass dims + slice — sidesteps any ndarray version-mismatch
        // between our crate and ort's internal re-export of ndarray.
        let shape_dims = [1usize, 3, SIZE as usize, SIZE as usize];
        let input_slice = input
            .as_slice()
            .ok_or_else(|| AppError::Internal("input not contiguous".into()))?;
        let input_tensor = TensorRef::from_array_view((shape_dims, input_slice))
            .map_err(|e| AppError::Internal(format!("tensor view: {e}")))?;

        let outputs = session
            .run(ort::inputs![input_name.as_str() => input_tensor])
            .map_err(|e| AppError::Internal(format!("inference: {e}")))?;

        // u2netp outputs 7 mask scales [1, 7, H, W] OR a single mask
        // [1, 1, H, W] depending on the export. We always take channel 0,
        // which is the finest (and the only one for the ONNX exports
        // published by `rembg`).
        let first_key = outputs
            .keys()
            .next()
            .ok_or_else(|| AppError::Internal("no model outputs".into()))?
            .to_string();
        let raw = outputs[first_key.as_str()]
            .try_extract_array::<f32>()
            .map_err(|e| AppError::Internal(format!("output extract: {e}")))?;
        let shape = raw.shape().to_vec();
        if shape.len() < 4 || shape[2] != SIZE as usize || shape[3] != SIZE as usize {
            return Err(AppError::Internal(format!(
                "unexpected mask shape {shape:?}, want [_, _, {SIZE}, {SIZE}]"
            )));
        }

        // 3. Min/max normalize the mask to [0, 1].
        let mut mask: Vec<f32> = Vec::with_capacity((SIZE * SIZE) as usize);
        for y in 0..SIZE as usize {
            for x in 0..SIZE as usize {
                mask.push(raw[[0, 0, y, x]]);
            }
        }
        let (mut lo, mut hi) = (f32::INFINITY, f32::NEG_INFINITY);
        for &v in &mask {
            if v < lo {
                lo = v;
            }
            if v > hi {
                hi = v;
            }
        }
        let range = (hi - lo).max(1e-6);
        for v in &mut mask {
            *v = ((*v - lo) / range).clamp(0.0, 1.0);
        }

        // 4. Build a single-channel L8 image, then resize back to original
        //    dims with Lanczos for clean edges.
        let mask_img: ImageBuffer<image::Luma<u8>, Vec<u8>> =
            ImageBuffer::from_fn(SIZE, SIZE, |x, y| {
                let idx = (y as usize) * (SIZE as usize) + (x as usize);
                image::Luma([(mask[idx] * 255.0).round() as u8])
            });
        let mask_full = image::imageops::resize(&mask_img, ow, oh, FilterType::Lanczos3);

        // 5. Composite: keep original RGB, replace alpha with mask.
        let src_rgba = original.to_rgba8();
        let mut out: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(ow, oh);
        for (x, y, src) in src_rgba.enumerate_pixels() {
            let alpha = mask_full.get_pixel(x, y).0[0];
            out.put_pixel(x, y, Rgba([src.0[0], src.0[1], src.0[2], alpha]));
        }
        out.save(&output_path)?;

        let meta =
            std::fs::metadata(&output_path).map_err(|e| AppError::from_io(e, &output_path))?;
        let _ = Array::<f32, _>::zeros(0); // silence ndarray import warning if needed
        Ok(RemoveBgResult {
            output_path,
            file_size: meta.len(),
        })
    })
    .await
    .map_err(|e| AppError::Internal(format!("join: {e}")))?
}
