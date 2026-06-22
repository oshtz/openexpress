//! CLI argument parsing for OpenExpress launches.
//!
//! Two entry points use this:
//! - first launch: parsed from `std::env::args_os()` during `setup`.
//! - second launch (single-instance handoff): parsed from the argv the
//!   first instance receives via the single-instance plugin callback.
//!
//! Output is a `LaunchAction` that the frontend can act on (navigate to a
//! tool, pre-fill the input file).

use serde::Serialize;
use std::ffi::OsString;

use crate::shell::tools;

#[derive(Debug, Clone, Serialize)]
pub struct LaunchAction {
    /// `Some` when invoked via `--tool <id>`. `None` when invoked with just a
    /// file path (e.g. Finder "Open With"), in which case the frontend shows
    /// a picker filtered by the file's extension.
    pub tool: Option<String>,
    pub route: String,
    pub file: Option<String>,
}

/// Parses argv into a launch action. Returns `None` only for argv that carry
/// neither a recognised `--tool` nor a file path — i.e. an ordinary launch
/// where the app should open to its Home page.
pub fn parse<I, T>(argv: I) -> Option<LaunchAction>
where
    I: IntoIterator<Item = T>,
    T: Into<OsString>,
{
    let mut args = argv.into_iter().map(Into::into);
    let _program = args.next();
    let mut tool = None;
    let mut file = None;

    while let Some(arg) = args.next() {
        let arg_text = arg.to_string_lossy();
        if arg_text == "--tool" {
            tool = Some(args.next()?.to_string_lossy().into_owned());
            continue;
        }

        if let Some(value) = arg_text.strip_prefix("--tool=") {
            tool = Some(value.to_string());
            continue;
        }

        if arg_text.starts_with('-') || file.is_some() {
            return None;
        }

        file = Some(arg_text.into_owned());
    }

    match tool {
        Some(tool_id) => match tools::find(&tool_id) {
            Some(spec) => Some(LaunchAction {
                tool: Some(spec.id.to_string()),
                route: spec.route.to_string(),
                file,
            }),
            None => {
                log::warn!("unknown tool id from CLI: {tool_id}");
                // Fall through to the picker if there's a file; otherwise no-op.
                file.map(|f| LaunchAction {
                    tool: None,
                    route: "/pick".to_string(),
                    file: Some(f),
                })
            }
        },
        None => file.map(|f| LaunchAction {
            tool: None,
            route: "/pick".to_string(),
            file: Some(f),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tool_and_file() {
        let action = parse(["openexpress", "--tool", "image-resize", "C:\\photo.jpg"]).unwrap();
        assert_eq!(action.tool.as_deref(), Some("image-resize"));
        assert_eq!(action.route, "/image/resize");
        assert_eq!(action.file.as_deref(), Some("C:\\photo.jpg"));
    }

    #[test]
    fn parses_tool_without_file() {
        let action = parse(["openexpress", "--tool", "video-trim"]).unwrap();
        assert_eq!(action.tool.as_deref(), Some("video-trim"));
        assert!(action.file.is_none());
    }

    #[test]
    fn bare_file_routes_to_picker() {
        let action = parse(["openexpress", "/some/file.jpg"]).unwrap();
        assert_eq!(action.tool, None);
        assert_eq!(action.route, "/pick");
        assert_eq!(action.file.as_deref(), Some("/some/file.jpg"));
    }

    #[test]
    fn unknown_tool_with_file_falls_back_to_picker() {
        let action = parse(["openexpress", "--tool", "nope", "/some/file.jpg"]).unwrap();
        assert_eq!(action.tool, None);
        assert_eq!(action.route, "/pick");
        assert_eq!(action.file.as_deref(), Some("/some/file.jpg"));
    }

    #[test]
    fn unknown_tool_without_file_is_noop() {
        assert!(parse(["openexpress", "--tool", "nope"]).is_none());
    }

    #[test]
    fn no_action_for_empty_argv() {
        assert!(parse(["openexpress"]).is_none());
    }
}
