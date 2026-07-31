use super::helpers::clone_object_deep;
use crate::output::write_output;
use crate::{AppError, AppResult};
use lopdf::{dictionary, Document, Object, ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PageOp {
    /// 1-indexed page number from the source document.
    pub source_page: u32,
    /// Rotation in degrees applied to the resulting page. Must be 0, 90,
    /// 180, or 270. Stored as the page's /Rotate value.
    pub rotation: i32,
}

#[derive(Debug, Serialize)]
pub struct OrganizeResult {
    pub output_path: String,
    pub page_count: u32,
    pub file_size: u64,
}

/// Build a new PDF whose pages are an arbitrary reordering of `input_path`'s
/// pages, with optional per-page rotation. Pages omitted from `ops` are
/// effectively deleted; a page can appear multiple times for duplication.
#[tauri::command]
pub async fn organize_pdf(
    input_path: String,
    output_path: String,
    ops: Vec<PageOp>,
) -> AppResult<OrganizeResult> {
    if ops.is_empty() {
        return Err(AppError::InvalidInput(
            "ops must contain at least one page".into(),
        ));
    }

    for op in &ops {
        if !matches!(op.rotation, 0 | 90 | 180 | 270) {
            return Err(AppError::InvalidInput(format!(
                "rotation must be 0, 90, 180, or 270 (got {})",
                op.rotation
            )));
        }
    }

    let doc = Document::load(&input_path)
        .map_err(|e| AppError::Pdf(format!("Failed to load {input_path}: {e}")))?;

    let mut sorted: Vec<_> = doc.get_pages().into_iter().collect();
    sorted.sort_by_key(|(num, _)| *num);
    let total = sorted.len() as u32;

    for op in &ops {
        if op.source_page == 0 || op.source_page > total {
            return Err(AppError::InvalidInput(format!(
                "source_page {} out of range 1..={total}",
                op.source_page
            )));
        }
    }

    let mut out = Document::with_version("1.5");
    let pages_id = out.new_object_id();
    let mut new_page_ids: Vec<ObjectId> = Vec::with_capacity(ops.len());

    for op in &ops {
        let (_, src_page_id) = sorted[(op.source_page - 1) as usize];
        let new_id = clone_object_deep(&doc, &src_page_id, &mut out);
        if let Ok(dict) = out.get_dictionary_mut(new_id) {
            dict.set("Parent", pages_id);
            // /Rotate is inheritable; setting it on the page itself wins.
            // Strip the key when rotation==0 so we don't carry stale state.
            if op.rotation == 0 {
                dict.remove(b"Rotate");
            } else {
                dict.set("Rotate", op.rotation as i64);
            }
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

    Ok(OrganizeResult {
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
    async fn organize_reorders_and_drops() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_n_page_pdf(&input, 4);

        // From 1,2,3,4 -> 4,2 (drop pages 1 and 3, reverse order of the rest)
        let result = organize_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            vec![
                PageOp {
                    source_page: 4,
                    rotation: 90,
                },
                PageOp {
                    source_page: 2,
                    rotation: 0,
                },
            ],
        )
        .await
        .unwrap();

        assert_eq!(result.page_count, 2);
        let reloaded = Document::load(&output).unwrap();
        assert_eq!(reloaded.get_pages().len(), 2);
    }

    #[tokio::test]
    async fn organize_rejects_invalid_rotation() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_n_page_pdf(&input, 2);

        let err = organize_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            vec![PageOp {
                source_page: 1,
                rotation: 45,
            }],
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn organize_rejects_out_of_range_page() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("in.pdf");
        let output = dir.path().join("out.pdf");
        write_n_page_pdf(&input, 2);

        let err = organize_pdf(
            input.to_string_lossy().into_owned(),
            output.to_string_lossy().into_owned(),
            vec![PageOp {
                source_page: 5,
                rotation: 0,
            }],
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
