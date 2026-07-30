//! Single source of truth for OpenExpress's quick-action tools.
//!
//! Every consumer reads from `tools()`:
//! - the CLI uses the id list for `--tool <id>` validation,
//! - the launch-action event sends the id to the frontend,
//! - the Windows registry writer iterates this slice,
//! - the frontend maps id → route via its own copy in `lib/tools.ts`.

#[derive(Debug, Clone, Copy)]
pub struct ToolSpec {
    /// Stable kebab-case identifier. Used in CLI args and event payloads.
    pub id: &'static str,
    /// Human label shown in the OS menu (no "with OpenExpress" suffix —
    /// the registry entry adds that for context).
    #[cfg_attr(
        not(target_os = "windows"),
        allow(
            dead_code,
            reason = "runtime shell menus consume labels only on Windows"
        )
    )]
    pub label: &'static str,
    /// Frontend route to navigate to when the launch action arrives.
    pub route: &'static str,
    /// File extensions this tool accepts. Lowercase, no leading dot.
    #[cfg_attr(
        not(any(target_os = "windows", test)),
        allow(
            dead_code,
            reason = "runtime shell extension registration exists only on Windows"
        )
    )]
    pub extensions: &'static [&'static str],
}

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "bmp", "tiff"];
const VIDEO_EXTS: &[&str] = &["mp4", "webm", "avi", "mov", "mkv"];
const PDF_EXTS: &[&str] = &["pdf"];
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "m4a", "flac", "ogg", "aac", "opus"];

const TOOLS: &[ToolSpec] = &[
    // Image
    ToolSpec {
        id: "image-resize",
        label: "Resize…",
        route: "/image/resize",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-crop",
        label: "Crop…",
        route: "/image/crop",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-convert",
        label: "Convert format…",
        route: "/image/convert",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-compress",
        label: "Compress…",
        route: "/image/compress",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-rotate",
        label: "Rotate / Flip…",
        route: "/image/rotate",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-adjust",
        label: "Adjust…",
        route: "/image/adjust",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-sharpen",
        label: "Sharpen…",
        route: "/image/sharpen",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-blur",
        label: "Blur…",
        route: "/image/blur",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-vector-trace",
        label: "Trace to SVG…",
        route: "/image/vector-trace",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-remove-bg",
        label: "Remove background...",
        route: "/image/remove-bg",
        extensions: IMAGE_EXTS,
    },
    ToolSpec {
        id: "image-upscale",
        label: "AI upscale…",
        route: "/image/upscale",
        extensions: IMAGE_EXTS,
    },
    // Video
    ToolSpec {
        id: "video-trim",
        label: "Trim…",
        route: "/video/trim",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-convert",
        label: "Convert format…",
        route: "/video/convert",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-resize",
        label: "Resize…",
        route: "/video/resize",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-to-gif",
        label: "Convert to GIF…",
        route: "/video/gif",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-speed",
        label: "Change speed…",
        route: "/video/speed",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-audio",
        label: "Extract audio…",
        route: "/video/audio",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-crop",
        label: "Crop…",
        route: "/video/crop",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-reverse",
        label: "Reverse…",
        route: "/video/reverse",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-mute",
        label: "Mute / remove audio…",
        route: "/video/mute",
        extensions: VIDEO_EXTS,
    },
    ToolSpec {
        id: "video-merge",
        label: "Merge with another…",
        route: "/video/merge",
        extensions: VIDEO_EXTS,
    },
    // PDF
    ToolSpec {
        id: "pdf-merge",
        label: "Merge...",
        route: "/pdf/merge",
        extensions: PDF_EXTS,
    },
    ToolSpec {
        id: "pdf-compress",
        label: "Compress…",
        route: "/pdf/compress",
        extensions: PDF_EXTS,
    },
    ToolSpec {
        id: "pdf-split",
        label: "Split / extract pages…",
        route: "/pdf/split",
        extensions: PDF_EXTS,
    },
    ToolSpec {
        id: "pdf-organize",
        label: "Organize pages…",
        route: "/pdf/organize",
        extensions: PDF_EXTS,
    },
    // Cross-category: image → PDF
    ToolSpec {
        id: "image-to-pdf",
        label: "Convert to PDF…",
        route: "/pdf/image-to-pdf",
        extensions: IMAGE_EXTS,
    },
    // Audio
    ToolSpec {
        id: "audio-trim",
        label: "Trim…",
        route: "/audio/trim",
        extensions: AUDIO_EXTS,
    },
    ToolSpec {
        id: "audio-convert",
        label: "Convert format…",
        route: "/audio/convert",
        extensions: AUDIO_EXTS,
    },
    ToolSpec {
        id: "audio-fade-in",
        label: "Fade in…",
        route: "/audio/fade-in",
        extensions: AUDIO_EXTS,
    },
    ToolSpec {
        id: "audio-fade-out",
        label: "Fade out…",
        route: "/audio/fade-out",
        extensions: AUDIO_EXTS,
    },
    ToolSpec {
        id: "audio-volume",
        label: "Adjust volume…",
        route: "/audio/volume",
        extensions: AUDIO_EXTS,
    },
];

#[cfg_attr(
    not(any(target_os = "windows", test)),
    allow(
        dead_code,
        reason = "full tool catalog is iterated only by runtime shell integration and tests"
    )
)]
pub fn tools() -> &'static [ToolSpec] {
    TOOLS
}

pub fn find(id: &str) -> Option<&'static ToolSpec> {
    TOOLS.iter().find(|t| t.id == id)
}

/// Returns the unique set of extensions that have at least one tool.
#[cfg_attr(
    not(any(target_os = "windows", test)),
    allow(
        dead_code,
        reason = "extension set is used only by runtime shell integration and tests"
    )
)]
pub fn all_extensions() -> Vec<&'static str> {
    let mut out: Vec<&'static str> = TOOLS
        .iter()
        .flat_map(|t| t.extensions.iter().copied())
        .collect();
    out.sort_unstable();
    out.dedup();
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn every_tool_has_unique_id() {
        let mut ids: Vec<_> = tools().iter().map(|t| t.id).collect();
        let count = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), count, "duplicate tool id");
    }

    #[test]
    fn shell_catalog_covers_all_routed_tools() {
        assert_eq!(tools().len(), 31);
        assert!(find("image-remove-bg").is_some());
        assert!(find("pdf-merge").is_some());
    }

    #[test]
    fn every_tool_has_at_least_one_extension() {
        for t in tools() {
            assert!(!t.extensions.is_empty(), "{} has no extensions", t.id);
        }
    }

    #[test]
    fn find_returns_some_for_known_id() {
        assert!(find("image-resize").is_some());
    }

    #[test]
    fn find_returns_none_for_unknown_id() {
        assert!(find("nope").is_none());
    }

    #[test]
    fn all_extensions_dedupes() {
        let exts = all_extensions();
        let mut sorted = exts.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted, exts, "all_extensions should be sorted and deduped");
        assert!(exts.contains(&"jpg"));
        assert!(exts.contains(&"pdf"));
    }

    #[test]
    fn macos_services_plist_advertises_every_tool() {
        let plist =
            plist::Value::from_reader_xml(std::io::Cursor::new(include_bytes!("../../Info.plist")))
                .expect("Info.plist should be valid XML plist");
        let services = plist
            .as_dictionary()
            .and_then(|dict| dict.get("NSServices"))
            .and_then(plist::Value::as_array)
            .expect("Info.plist should declare NSServices");

        assert_eq!(
            services.len(),
            tools().len(),
            "macOS Services should match the shell tool catalog"
        );

        let mut advertised = HashSet::new();
        for service in services {
            let service = service.as_dictionary().expect("service should be a dict");
            assert_eq!(
                service.get("NSMessage").and_then(plist::Value::as_string),
                Some("openexpressService")
            );
            assert_eq!(
                service.get("NSPortName").and_then(plist::Value::as_string),
                Some("OpenExpress")
            );
            assert!(
                service
                    .get("NSRequiredContext")
                    .and_then(plist::Value::as_dictionary)
                    .is_some(),
                "service should include NSRequiredContext so it appears automatically"
            );
            assert!(
                service
                    .get("NSSendFileTypes")
                    .and_then(plist::Value::as_array)
                    .is_some_and(|types| !types.is_empty()),
                "service should declare at least one file UTI"
            );
            advertised.insert(
                service
                    .get("NSUserData")
                    .and_then(plist::Value::as_string)
                    .expect("service should carry the tool id in NSUserData"),
            );
        }

        for tool in tools() {
            assert!(
                advertised.contains(tool.id),
                "{} missing from macOS Services plist",
                tool.id
            );
        }
    }
}
