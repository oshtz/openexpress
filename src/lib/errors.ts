/**
 * Structured-error contract between the Rust `AppError` enum and the
 * frontend. Variants must stay in sync with `src-tauri/src/error.rs`.
 */

export type AppErrorKind =
  | "FileNotFound"
  | "PermissionDenied"
  | "Io"
  | "InvalidInput"
  | "DecodeFailed"
  | "EncodeFailed"
  | "Pdf"
  | "FfmpegUnavailable"
  | "FfmpegFailed"
  | "Cancelled"
  | "FeatureDisabled"
  | "Internal";

export interface AppError {
  kind: AppErrorKind;
  message: string;
}

/**
 * Coerces whatever invoke() rejected with into a structured AppError.
 *
 * Tauri serializes our `#[derive(Serialize)]` enum, so the rejection is
 * already a JS object — we just type-narrow. Older / non-typed errors
 * (plain strings, JS Errors) are wrapped in an "Internal" variant.
 */
export function toAppError(raw: unknown): AppError {
  if (typeof raw === "object" && raw !== null && "kind" in raw && "message" in raw) {
    const obj = raw as { kind: unknown; message: unknown };
    if (typeof obj.kind === "string" && typeof obj.message === "string") {
      return { kind: obj.kind as AppErrorKind, message: obj.message };
    }
  }
  if (raw instanceof Error) {
    return { kind: "Internal", message: raw.message };
  }
  return { kind: "Internal", message: String(raw) };
}

/**
 * UX presentation for each error kind.
 *
 * - `severity` drives the toast / error-panel color
 * - `hint` is an actionable one-liner shown under the raw message
 * - `silent` skips the toast (used for user-initiated cancellation)
 */
export interface ErrorPresentation {
  severity: "error" | "warning" | "info";
  hint?: string;
  silent?: boolean;
}

const PRESENTATION: Record<AppErrorKind, ErrorPresentation> = {
  FileNotFound: {
    severity: "warning",
    hint: "The file may have been moved, renamed, or deleted.",
  },
  PermissionDenied: {
    severity: "warning",
    hint: "Try a different output folder, or close any app that has the file open.",
  },
  Io: {
    severity: "error",
    hint: "A disk read or write failed. Check available space and file permissions.",
  },
  InvalidInput: {
    severity: "warning",
    hint: "Adjust the tool settings and try again.",
  },
  DecodeFailed: {
    severity: "warning",
    hint: "The input file may be corrupt or in an unsupported format.",
  },
  EncodeFailed: {
    severity: "error",
    hint: "Try a different output format or quality setting.",
  },
  Pdf: {
    severity: "error",
    hint: "The PDF may be encrypted or use an unsupported feature.",
  },
  FfmpegUnavailable: {
    severity: "error",
    hint: "FFmpeg failed to install. Check your internet connection and try again.",
  },
  FfmpegFailed: {
    severity: "error",
    hint: "FFmpeg reported an error processing this file.",
  },
  Cancelled: {
    severity: "info",
    silent: true,
  },
  FeatureDisabled: {
    severity: "info",
    hint: "Rebuild with the relevant cargo feature flag to enable.",
  },
  Internal: {
    severity: "error",
    hint: "An unexpected error occurred. Please report this in the issue tracker.",
  },
};

export function presentationFor(error: AppError): ErrorPresentation {
  return PRESENTATION[error.kind] ?? PRESENTATION.Internal;
}
