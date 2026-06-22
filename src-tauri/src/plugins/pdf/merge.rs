use super::helpers::clone_object_deep;
use crate::{AppError, AppResult};
use lopdf::{dictionary, Document, Object, ObjectId};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MergeResult {
    pub output_path: String,
    pub page_count: u32,
    pub file_size: u64,
}

#[tauri::command]
pub async fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> AppResult<MergeResult> {
    if input_paths.is_empty() {
        return Err(AppError::InvalidInput("no input files provided".into()));
    }

    let documents: Vec<Document> = input_paths
        .iter()
        .map(|path| {
            Document::load(path).map_err(|e| AppError::Pdf(format!("Failed to load {path}: {e}")))
        })
        .collect::<AppResult<Vec<_>>>()?;

    // Use a fresh merged document
    let mut merged = Document::with_version("1.5");
    let pages_id = merged.new_object_id();
    let mut all_page_ids: Vec<ObjectId> = Vec::new();

    for doc in &documents {
        let pages = doc.get_pages();
        let mut sorted_pages: Vec<_> = pages.into_iter().collect();
        sorted_pages.sort_by_key(|(num, _)| *num);

        for (_, page_id) in sorted_pages {
            // Deep-clone the page and all referenced objects into the merged document
            let new_page_id = clone_object_deep(doc, &page_id, &mut merged);

            // Ensure the page's Parent reference points to our new pages dict
            if let Ok(page_dict) = merged.get_dictionary_mut(new_page_id) {
                page_dict.set("Parent", pages_id);
            }

            all_page_ids.push(new_page_id);
        }
    }

    let page_count = all_page_ids.len() as u32;
    let page_refs: Vec<Object> = all_page_ids.iter().map(|&id| id.into()).collect();

    merged.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_refs,
            "Count" => page_count as i64,
        }),
    );

    let catalog_id = merged.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    merged.trailer.set("Root", catalog_id);

    merged
        .save(&output_path)
        .map_err(|e| AppError::from_io(e, &output_path))?;

    let file_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(MergeResult {
        output_path,
        page_count,
        file_size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a minimal single-page PDF for tests and save it.
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
    async fn merge_two_single_page_pdfs_yields_two_pages() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.pdf");
        let b = dir.path().join("b.pdf");
        let out = dir.path().join("merged.pdf");
        write_minimal_pdf(&a);
        write_minimal_pdf(&b);

        let result = merge_pdfs(
            vec![
                a.to_string_lossy().into_owned(),
                b.to_string_lossy().into_owned(),
            ],
            out.to_string_lossy().into_owned(),
        )
        .await
        .unwrap();

        assert_eq!(result.page_count, 2);
        assert!(result.file_size > 0);

        // Verify the merged PDF actually parses back to 2 pages
        let parsed = Document::load(&out).unwrap();
        assert_eq!(parsed.get_pages().len(), 2);
    }

    #[tokio::test]
    async fn merge_empty_input_errors() {
        let result = merge_pdfs(vec![], "C:\\out.pdf".to_string()).await;
        assert!(result.is_err());
    }
}
