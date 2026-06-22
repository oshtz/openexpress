import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FileText } from "lucide-react";
import { pasteImageAsFile } from "../../lib/clipboard";

const RASTER_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff", "gif"];

interface FileDropzoneProps {
  accept?: string[];
  multiple?: boolean;
  onFiles: (paths: string[]) => void;
  label?: string;
}

function extensionOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  label = "Drop files here or click to browse",
}: FileDropzoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef(accept);
  const multipleRef = useRef(multiple);
  const onFilesRef = useRef(onFiles);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    acceptRef.current = accept;
    multipleRef.current = multiple;
    onFilesRef.current = onFiles;
  });

  const hasFile =
    label !== "Drop files here or click to browse" && !label.startsWith("Drop");

  const handleClick = useCallback(async () => {
    const filters = accept ? [{ name: "Accepted files", extensions: accept }] : [];
    const result = await open({ multiple, filters });
    if (result) {
      const paths = Array.isArray(result) ? result : [result];
      onFiles(paths);
    }
  }, [accept, multiple, onFiles]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const isInside = (x: number, y: number) => {
      const el = containerRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const passesAccept = (path: string) => {
      const allowed = acceptRef.current;
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(extensionOf(path));
    };

    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return undefined;
    }

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "over") {
          setIsDragging(isInside(payload.position.x, payload.position.y));
        } else if (payload.type === "leave") {
          setIsDragging(false);
        } else if (payload.type === "drop") {
          setIsDragging(false);
          if (!isInside(payload.position.x, payload.position.y)) return;
          const filtered = payload.paths.filter(passesAccept);
          if (filtered.length === 0) return;
          const paths = multipleRef.current ? filtered : filtered.slice(0, 1);
          onFilesRef.current(paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  // Ctrl/Cmd+O opens the file dialog on the currently-mounted dropzone.
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      navigator.platform.toLowerCase().includes("mac");
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "o") return;
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      void handleClick();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClick]);

  // Paste: only meaningful for image dropzones — we materialize a clipboard
  // bitmap into a temp PNG and feed it through onFiles like any other input.
  const acceptsImages =
    !accept || accept.some((ext) => RASTER_IMAGE_EXTS.includes(ext.toLowerCase()));
  useEffect(() => {
    if (!acceptsImages) return;
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;

    const handler = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, [contenteditable=true]")) return;
      try {
        const path = await pasteImageAsFile();
        onFilesRef.current([path]);
      } catch {
        // No image on clipboard, or user pasted text in a context that lets
        // text paste pass through. Either way: silent no-op.
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [acceptsImages]);

  const borderColor = isDragging
    ? "var(--color-accent-gold)"
    : hasFile
      ? "var(--color-text)"
      : "var(--color-border)";

  const tickColor = isDragging ? "var(--color-text)" : "var(--color-text-muted)";
  const TICK = 12;
  const cornerTicks = (
    <>
      <span
        aria-hidden
        className="absolute transition-colors"
        style={{ top: 8, left: 8, width: TICK, height: TICK, borderTop: `1px solid ${tickColor}`, borderLeft: `1px solid ${tickColor}` }}
      />
      <span
        aria-hidden
        className="absolute transition-colors"
        style={{ top: 8, right: 8, width: TICK, height: TICK, borderTop: `1px solid ${tickColor}`, borderRight: `1px solid ${tickColor}` }}
      />
      <span
        aria-hidden
        className="absolute transition-colors"
        style={{ bottom: 8, left: 8, width: TICK, height: TICK, borderBottom: `1px solid ${tickColor}`, borderLeft: `1px solid ${tickColor}` }}
      />
      <span
        aria-hidden
        className="absolute transition-colors"
        style={{ bottom: 8, right: 8, width: TICK, height: TICK, borderBottom: `1px solid ${tickColor}`, borderRight: `1px solid ${tickColor}` }}
      />
    </>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      role="button"
      aria-label={hasFile ? `Selected file: ${label}. Activate to choose a different file.` : label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void handleClick();
        }
      }}
      className="relative flex min-h-[272px] cursor-pointer items-center justify-center transition-colors"
      style={{
        border: `1px ${isDragging ? "solid" : "dashed"} ${borderColor}`,
        padding: "40px 32px",
        background: isDragging
          ? "var(--color-accent-light)"
          : hasFile
            ? "var(--color-bg-secondary)"
            : "var(--color-bg)",
      }}
    >
      {cornerTicks}
      <div className="relative flex flex-col items-center text-center">
        {hasFile ? (
          <>
            <FileText size={24} strokeWidth={1.25} style={{ color: "var(--color-text)" }} />
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text)",
                maxWidth: "60ch",
                wordBreak: "break-all",
              }}
            >
              {label}
            </p>
            <p
              className="mt-1"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              Click to change
            </p>
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="numeral-outline select-none"
              style={{ fontSize: 64, lineHeight: 0.85 }}
            >
              +
            </div>
            <p
              className="mt-5"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {label}
            </p>
            <p className="mt-2 text-[12px] text-text-secondary">
              Or press Ctrl/Cmd+O to choose from disk
              {acceptsImages && " · Ctrl/Cmd+V to paste an image"}
            </p>
            {accept && (
              <p className="mt-5 max-w-[520px] font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                {accept.map((a) => `.${a}`).join(" · ")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
