//! Central error taxonomy for OpenExpress commands.
//!
//! Every Tauri command returns `Result<T, AppError>`. The enum serializes to
//! the frontend as `{ kind: "VariantName", message: "..." }`, so the UI can
//! distinguish "file not found" from "ffmpeg crashed" from "cancelled" and
//! present appropriate icons + actions.
//!
//! Adding a new variant: also add a matching arm in `JS_KIND` on the
//! frontend (`src/lib/errors.ts`).

use serde::{Serialize, Serializer};
use std::io;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Failed to decode image: {0}")]
    DecodeFailed(String),

    #[error("Failed to encode image: {0}")]
    EncodeFailed(String),

    #[error("PDF error: {0}")]
    Pdf(String),

    #[error("FFmpeg is not available: {0}")]
    FfmpegUnavailable(String),

    #[error("FFmpeg failed: {0}")]
    FfmpegFailed(String),

    #[error("Cancelled by user")]
    Cancelled,

    #[error("Feature not enabled: {0}")]
    FeatureDisabled(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    /// Variant discriminator used by the frontend to route error UX.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::FileNotFound(_) => "FileNotFound",
            Self::PermissionDenied(_) => "PermissionDenied",
            Self::Io(_) => "Io",
            Self::InvalidInput(_) => "InvalidInput",
            Self::DecodeFailed(_) => "DecodeFailed",
            Self::EncodeFailed(_) => "EncodeFailed",
            Self::Pdf(_) => "Pdf",
            Self::FfmpegUnavailable(_) => "FfmpegUnavailable",
            Self::FfmpegFailed(_) => "FfmpegFailed",
            Self::Cancelled => "Cancelled",
            Self::FeatureDisabled(_) => "FeatureDisabled",
            Self::Internal(_) => "Internal",
        }
    }

    /// Wraps an `io::Error` together with the path that produced it, so the
    /// "file not found" / "permission denied" cases carry useful context.
    pub fn from_io(err: io::Error, path: impl AsRef<str>) -> Self {
        let p = path.as_ref().to_string();
        match err.kind() {
            io::ErrorKind::NotFound => Self::FileNotFound(p),
            io::ErrorKind::PermissionDenied => Self::PermissionDenied(p),
            _ => Self::Io(format!("{p}: {err}")),
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut state = s.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

// Generic conversions for the cases where we don't have a specific path
// context. Commands that want better messages should use `AppError::from_io`
// explicitly with the path.

impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => Self::FileNotFound(err.to_string()),
            io::ErrorKind::PermissionDenied => Self::PermissionDenied(err.to_string()),
            _ => Self::Io(err.to_string()),
        }
    }
}

impl From<image::ImageError> for AppError {
    fn from(err: image::ImageError) -> Self {
        use image::ImageError;
        match err {
            ImageError::IoError(io_err) => io_err.into(),
            ImageError::Decoding(_) | ImageError::Unsupported(_) => {
                Self::DecodeFailed(err.to_string())
            }
            ImageError::Encoding(_) | ImageError::Parameter(_) | ImageError::Limits(_) => {
                Self::EncodeFailed(err.to_string())
            }
        }
    }
}

impl From<lopdf::Error> for AppError {
    fn from(err: lopdf::Error) -> Self {
        Self::Pdf(err.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_emits_kind_and_message() {
        let err = AppError::FileNotFound("C:/missing.png".into());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["kind"], "FileNotFound");
        assert_eq!(json["message"], "File not found: C:/missing.png");
    }

    #[test]
    fn from_io_maps_not_found() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "nope");
        let app_err = AppError::from_io(io_err, "C:/foo.png");
        assert_eq!(app_err.kind(), "FileNotFound");
    }

    #[test]
    fn from_io_maps_permission_denied() {
        let io_err = io::Error::new(io::ErrorKind::PermissionDenied, "nope");
        let app_err = AppError::from_io(io_err, "C:/foo.png");
        assert_eq!(app_err.kind(), "PermissionDenied");
    }

    #[test]
    fn cancelled_has_static_message() {
        let err = AppError::Cancelled;
        assert_eq!(err.to_string(), "Cancelled by user");
        assert_eq!(err.kind(), "Cancelled");
    }
}
