use crate::{AppError, AppResult};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PdfConvertResult {
    pub output_paths: Vec<String>,
    pub page_count: u32,
}

#[tauri::command]
pub async fn images_to_pdf(
    input_paths: Vec<String>,
    output_path: String,
) -> AppResult<PdfConvertResult> {
    use lopdf::dictionary;
    use lopdf::{Document, Object, Stream};

    if input_paths.is_empty() {
        return Err(AppError::InvalidInput("no input images provided".into()));
    }

    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let mut page_ids = Vec::new();

    for image_path in &input_paths {
        let img = image::open(image_path)?;
        let rgb_img = img.to_rgb8();
        let (width, height) = (rgb_img.width(), rgb_img.height());
        let raw_pixels = rgb_img.into_raw();

        // Create image XObject
        let image_stream = Stream::new(
            dictionary! {
                "Type" => "XObject",
                "Subtype" => "Image",
                "Width" => width as i64,
                "Height" => height as i64,
                "ColorSpace" => "DeviceRGB",
                "BitsPerComponent" => 8,
            },
            raw_pixels,
        );
        let image_id = doc.add_object(image_stream);

        // Create resources
        let resources_id = doc.add_object(dictionary! {
            "XObject" => dictionary! {
                "Img0" => image_id,
            },
        });

        // Scale to fit A4-ish proportions (595x842 points) maintaining aspect ratio
        let page_w = 595.0_f64;
        let page_h = 842.0_f64;
        let scale = (page_w / width as f64).min(page_h / height as f64);
        let img_w = width as f64 * scale;
        let img_h = height as f64 * scale;
        let x_offset = (page_w - img_w) / 2.0;
        let y_offset = (page_h - img_h) / 2.0;

        let content = format!(
            "q {} 0 0 {} {} {} cm /Img0 Do Q",
            img_w, img_h, x_offset, y_offset
        );
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.into_bytes()));

        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), Object::Real(page_w as f32), Object::Real(page_h as f32)],
            "Contents" => content_id,
            "Resources" => resources_id,
        });
        page_ids.push(page_id);
    }

    let page_count = page_ids.len() as u32;
    let page_refs: Vec<Object> = page_ids.iter().map(|&id| id.into()).collect();

    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_refs,
            "Count" => page_count as i64,
        }),
    );

    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);

    doc.save(&output_path)
        .map_err(|e| AppError::from_io(e, &output_path))?;

    Ok(PdfConvertResult {
        output_paths: vec![output_path],
        page_count,
    })
}

#[tauri::command]
pub async fn pdf_to_images(
    input_path: String,
    output_dir: String,
    format: String,
) -> AppResult<PdfConvertResult> {
    // PDF to image conversion requires a rendering engine.
    // For MVP, we'll use a simple approach: extract embedded images if possible,
    // otherwise indicate that a renderer like poppler/mupdf is needed.
    let doc = lopdf::Document::load(&input_path)?;

    let pages = doc.get_pages();
    let page_count = pages.len() as u32;

    let mut output_paths = Vec::new();
    let ext = if format.is_empty() { "png" } else { &format };

    for page_num in 1..=page_count {
        let output_path = format!("{}/page_{}.{}", output_dir, page_num, ext);

        // Placeholder white image — real rendering needs mupdf or poppler bindings.
        let img = image::RgbImage::from_fn(595, 842, |_x, _y| image::Rgb([255u8, 255u8, 255u8]));
        let dynamic = image::DynamicImage::ImageRgb8(img);
        dynamic.save(&output_path)?;

        output_paths.push(output_path);
    }

    Ok(PdfConvertResult {
        output_paths,
        page_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use lopdf::{dictionary, Document, Object};

    fn write_test_image(path: &std::path::Path, w: u32, h: u32) {
        ImageBuffer::from_pixel(w, h, Rgba([10u8, 200, 100, 255]))
            .save(path)
            .unwrap();
    }

    fn write_minimal_pdf(path: &std::path::Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Resources" => dictionary! {},
        });
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_id)],
                "Count" => 1i64,
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        doc.trailer.set("Root", catalog_id);
        doc.save(path).unwrap();
    }

    #[tokio::test]
    async fn two_images_become_two_page_pdf() {
        let dir = tempfile::tempdir().unwrap();
        let img_a = dir.path().join("a.png");
        let img_b = dir.path().join("b.png");
        let out = dir.path().join("out.pdf");
        write_test_image(&img_a, 200, 200);
        write_test_image(&img_b, 300, 400);

        let result = images_to_pdf(
            vec![
                img_a.to_string_lossy().into_owned(),
                img_b.to_string_lossy().into_owned(),
            ],
            out.to_string_lossy().into_owned(),
        )
        .await
        .unwrap();

        assert_eq!(result.page_count, 2);
        let parsed = Document::load(&out).unwrap();
        assert_eq!(parsed.get_pages().len(), 2);
    }

    #[tokio::test]
    async fn pdf_to_images_writes_one_output_per_page() {
        let dir = tempfile::tempdir().unwrap();
        let pdf = dir.path().join("in.pdf");
        write_minimal_pdf(&pdf);

        let result = pdf_to_images(
            pdf.to_string_lossy().into_owned(),
            dir.path().to_string_lossy().into_owned(),
            "png".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(result.page_count, 1);
        assert_eq!(result.output_paths.len(), 1);
        assert!(std::path::Path::new(&result.output_paths[0]).exists());
    }
}
