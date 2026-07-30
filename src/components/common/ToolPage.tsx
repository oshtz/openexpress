import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOOLS } from "../../lib/tools";

interface ToolPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  /**
   * Left-column content shown until something is uploaded. Usually a
   * FileDropzone. Falls back to filling the whole 2-col row when there's
   * no `preview` to swap in.
   */
  upload?: ReactNode;
  /**
   * Left-column content shown after upload — usually an `ImagePreview` or
   * `VideoPlayer`. When this is truthy it replaces `upload`, and a Clear
   * button appears (top-right of the column) if `onClear` is set.
   */
  preview?: ReactNode;
  /**
   * Right-column controls + action button. Required for the 2-col layout
   * to kick in; if omitted, ToolPage falls back to its legacy single-
   * column behavior and just renders `children`.
   */
  controls?: ReactNode;
  /**
   * Wires the Clear button (shown only when `preview` is set). Should
   * reset input paths and any tool-local state.
   */
  onClear?: () => void;
  /**
   * Full-width content rendered below the 2-col grid — progress bar,
   * error panel, result panel, BeforeAfter splitter, batch result lists.
   */
  children: ReactNode;
}

function accentFromPath(pathname: string): string {
  if (pathname.startsWith("/image/")) return "var(--color-accent-gold)";
  if (pathname.startsWith("/video/")) return "var(--color-accent-steel)";
  if (pathname.startsWith("/pdf/")) return "var(--color-accent-signal)";
  if (pathname.startsWith("/audio/")) return "var(--color-accent-sage)";
  return "var(--color-text)";
}

export function ToolPage({
  title,
  description,
  icon,
  upload,
  preview,
  controls,
  onClear,
  children,
}: ToolPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const accent = accentFromPath(location.pathname);

  // Editorial index — "TOOL 07 / 31 — IMAGE". Skipped for non-tool routes
  // (Settings) that render through ToolPage.
  const toolIdx = TOOLS.findIndex((t) => t.route === location.pathname);
  const toolCategory = TOOLS[toolIdx]?.category;

  // `icon` is accepted for backwards-compat but not rendered — the Swiss
  // header uses an accent swatch for category, not per-tool glyphs.
  void icon;

  const hasGrid = Boolean(controls);
  const leftIsPreview = Boolean(preview);

  return (
    <div className="max-w-[1280px] mx-auto animate-fade-in-up">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-6 transition-colors"
        aria-label="Go back to the previous page"
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--color-text-secondary)",
        }}
      >
        <ArrowLeft size={12} />
        <span>Back</span>
      </button>

      <header className="mb-8">
        <div className="flex items-start gap-5">
          <span
            className="mt-2 shrink-0"
            style={{
              width: 18,
              height: 18,
              background: accent,
              display: "inline-block",
            }}
            aria-hidden
          />
          <div>
            {toolIdx >= 0 && (
              <div
                className="mb-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                }}
              >
                Tool {String(toolIdx + 1).padStart(2, "0")} / {TOOLS.length} —{" "}
                {toolCategory}
              </div>
            )}
            <h1
              className="swiss-display"
              style={{
                fontWeight: 700,
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                letterSpacing: "-0.035em",
                lineHeight: 0.95,
                color: "var(--color-text)",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--color-text-secondary)",
                maxWidth: "58ch",
                marginTop: 14,
              }}
            >
              {description}
            </p>
          </div>
        </div>
      </header>

      {hasGrid ? (
        <>
          <section
            className="tool-workspace mb-7 border border-border bg-bg-secondary"
            style={{ borderTop: `4px solid ${accent}` }}
            aria-labelledby="tool-input-heading"
          >
            <div className="grid grid-cols-1 border-b border-border-subtle md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div id="tool-input-heading" className="swiss-label px-6 py-3">
                <span style={{ fontFamily: "var(--font-mono)", marginRight: 8 }}>01</span>
                Input
              </div>
              <div className="swiss-label border-t border-border-subtle px-6 py-3 md:border-l md:border-t-0">
                <span style={{ fontFamily: "var(--font-mono)", marginRight: 8 }}>02</span>
                Settings
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="relative min-h-[320px] p-6">
                {leftIsPreview && onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    title="Clear (Esc)"
                    aria-label="Clear selected file"
                    className="absolute top-8 right-8 z-10 flex items-center gap-1.5 border border-border bg-bg-secondary px-2.5 py-1.5 text-text-secondary transition-colors hover:border-text hover:text-text"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    <X size={12} />
                    Clear
                  </button>
                )}
                {leftIsPreview ? preview : upload}
              </div>

              <div className="tool-controls border-t border-border-subtle p-6 md:border-l md:border-t-0">
                <div className="space-y-4">
                  {controls}
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-6">{children}</div>
        </>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  );
}
