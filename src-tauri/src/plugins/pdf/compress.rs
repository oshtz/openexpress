use crate::{AppError, AppResult};
use lopdf::Document;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CompressResult {
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub savings_percent: f32,
}

#[tauri::command]
pub async fn compress_pdf(input_path: String, output_path: String) -> AppResult<CompressResult> {
    let original_size = std::fs::metadata(&input_path)
        .map_err(|e| AppError::from_io(e, &input_path))?
        .len();

    let mut doc = Document::load(&input_path)?;

    doc.compress();
    doc.delete_zero_length_streams();
    doc.prune_objects();

    doc.save(&output_path)
        .map_err(|e| AppError::from_io(e, &output_path))?;

    let compressed_size = std::fs::metadata(&output_path)
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
    use lopdf::{dictionary, Object};

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
    async fn compress_preserves_pdf_validity() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_minimal_pdf(&input);

        let result = compress_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
        )
        .await
        .unwrap();

        assert!(result.original_size > 0);
        assert!(result.compressed_size > 0);

        // Compressed PDF must still be parseable
        let reloaded = Document::load(&output).unwrap();
        assert_eq!(reloaded.get_pages().len(), 1);
    }

    #[tokio::test]
    async fn compress_missing_input_errors() {
        let result = compress_pdf("C:\\nope.pdf".to_string(), "C:\\out.pdf".to_string()).await;
        assert!(result.is_err());
    }
}
