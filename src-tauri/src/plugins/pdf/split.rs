use super::helpers::clone_object_deep;
use crate::output::write_output;
use crate::{AppError, AppResult};
use lopdf::{dictionary, Document, Object, ObjectId};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SplitResult {
    pub output_path: String,
    pub page_count: u32,
    pub file_size: u64,
}

/// Extract a contiguous page range `[start_page, end_page]` (1-indexed,
/// inclusive) from `input_path` into a new PDF at `output_path`. To pull a
/// single page, set start_page == end_page.
#[tauri::command]
pub async fn split_pdf(
    input_path: String,
    output_path: String,
    start_page: u32,
    end_page: u32,
) -> AppResult<SplitResult> {
    if start_page == 0 {
        return Err(AppError::InvalidInput(
            "start_page must be 1 or greater (PDFs are 1-indexed)".into(),
        ));
    }
    if end_page < start_page {
        return Err(AppError::InvalidInput(format!(
            "end_page ({end_page}) must be greater than or equal to start_page ({start_page})"
        )));
    }

    let doc = Document::load(&input_path)
        .map_err(|e| AppError::Pdf(format!("Failed to load {input_path}: {e}")))?;

    let pages = doc.get_pages();
    let total = pages.len() as u32;
    if end_page > total {
        return Err(AppError::InvalidInput(format!(
            "end_page ({end_page}) exceeds page count ({total})"
        )));
    }

    let mut sorted: Vec<_> = pages.into_iter().collect();
    sorted.sort_by_key(|(num, _)| *num);

    let mut out = Document::with_version("1.5");
    let pages_id = out.new_object_id();
    let mut new_page_ids: Vec<ObjectId> = Vec::new();

    for (page_num, page_id) in sorted {
        if page_num < start_page || page_num > end_page {
            continue;
        }
        let new_id = clone_object_deep(&doc, &page_id, &mut out);
        if let Ok(dict) = out.get_dictionary_mut(new_id) {
            dict.set("Parent", pages_id);
        }
        new_page_ids.push(new_id);
    }

    let page_count = new_page_ids.len() as u32;
    let page_refs: Vec<Object> = new_page_ids.iter().map(|&id| id.into()).collect();
    out.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_refs,
            "Count" => page_count as i64,
        }),
    );
    let catalog_id = out.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    out.trailer.set("Root", catalog_id);

    let output_path = write_output(output_path, |path| {
        out.save(path)
            .map(|_| ())
            .map_err(|error| AppError::from_io(error, path.to_string_lossy()))
    })?;

    let file_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(SplitResult {
        output_path,
        page_count,
        file_size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_n_page_pdf(path: &std::path::Path, n: u32) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let mut kids: Vec<Object> = Vec::new();
        for _ in 0..n {
            let pid = doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
                "Resources" => dictionary! {},
            });
            kids.push(Object::Reference(pid));
        }
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => kids,
                "Count" => n as i64,
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
    async fn split_extracts_requested_range() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_n_page_pdf(&input, 5);

        let result = split_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            2,
            4,
        )
        .await
        .unwrap();

        assert_eq!(result.page_count, 3);
        let reloaded = Document::load(&output).unwrap();
        assert_eq!(reloaded.get_pages().len(), 3);
    }

    #[tokio::test]
    async fn split_rejects_out_of_range() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_n_page_pdf(&input, 3);

        let err = split_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            2,
            10,
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
