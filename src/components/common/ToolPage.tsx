import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOOLS } from "../../lib/tools";

interface ToolPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  /** Left-column content shown until a file is selected. */
  upload?: ReactNode;
  /** Left-column preview shown after a file is selected. */
  preview?: ReactNode;
  /** Right-column controls and primary action. */
  controls?: ReactNode;
  /** Clears the current input and tool-local state. */
  onClear?: () => void;
  /** Progress, error, and result content shown below the workspace. */
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
  const toolIndex = TOOLS.findIndex((tool) => tool.route === location.pathname);
  const toolCategory = TOOLS[toolIndex]?.category;

  // Kept for existing callers; the shared header uses the category accent.
  void icon;

  const hasGrid = Boolean(controls);
  const inputReady = Boolean(preview);
  const settingsStatus = inputReady ? "Ready to process" : "Choose a file to continue";

  return (
    <div className="tool-page animate-fade-in-up">
      <div className="tool-page-header">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="press-feedback mb-4 flex items-center gap-2"
        aria-label="Go back to the previous page"
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0,
          textTransform: "uppercase",
          color: "var(--color-text-secondary)",
        }}
      >
        <ArrowLeft size={12} />
        <span>Back</span>
      </button>

      <header>
        <div className="flex items-start gap-5">
          <span
            className="mt-1.5 shrink-0"
            style={{
              width: 16,
              height: 16,
              background: accent,
              display: "inline-block",
            }}
            aria-hidden
          />
          <div>
            {toolIndex >= 0 && (
              <div className="mb-3 text-[11px] uppercase text-text-muted">
                Tool {String(toolIndex + 1).padStart(2, "0")} / {TOOLS.length} / {toolCategory}
              </div>
            )}
            <h1
              className="swiss-display"
              style={{
                fontWeight: 700,
                fontSize: 42,
                letterSpacing: 0,
                lineHeight: 1,
                color: "var(--color-text)",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.45,
                color: "var(--color-text-secondary)",
                maxWidth: "58ch",
                marginTop: 10,
              }}
            >
              {description}
            </p>
          </div>
        </div>
      </header>
      </div>

      <div className="tool-page-content">
      {hasGrid ? (
        <>
          <section
            className="tool-workspace mb-6 border border-border bg-bg-secondary"
            style={{ borderTop: `4px solid ${accent}` }}
            aria-labelledby="tool-input-heading"
          >
            <div className="grid grid-cols-1 border-b border-border-subtle md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div id="tool-input-heading" className="swiss-label px-5 py-2.5">
                <span style={{ fontFamily: "var(--font-mono)", marginRight: 8 }}>01</span>
                Input
              </div>
              <div className="flex items-center border-t border-border-subtle px-5 py-2.5 md:border-l md:border-t-0">
                <span className="swiss-label">
                  <span style={{ fontFamily: "var(--font-mono)", marginRight: 8 }}>02</span>
                  Settings
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="relative min-h-[280px] p-5">
                {inputReady && onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    title="Clear (Esc)"
                    aria-label="Clear selected file"
                    className="press-feedback absolute right-7 top-7 z-10 flex items-center gap-1.5 border border-border bg-bg-secondary px-2.5 py-1.5 text-text-secondary hover:border-text hover:text-text"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    <X size={12} />
                    Clear
                  </button>
                )}
                {inputReady ? preview : upload}
              </div>

              <div
                className={`tool-controls border-t border-border-subtle p-5 md:border-l md:border-t-0 ${
                  inputReady ? "" : "bg-bg-tertiary/25"
                }`}
              >
                <p
                  id="tool-settings-status"
                  role="status"
                  className="mb-4 border-b border-border-subtle pb-3 text-[12px] font-medium text-text-secondary"
                >
                  {settingsStatus}
                </p>
                <fieldset
                  disabled={!inputReady}
                  aria-describedby="tool-settings-status"
                  className={`min-w-0 border-0 p-0 ${inputReady ? "" : "opacity-60"}`}
                >
                  <legend className="sr-only">Tool settings</legend>
                  <div className="space-y-4">{controls}</div>
                </fieldset>
              </div>
            </div>
          </section>

          <div className="space-y-6">{children}</div>
        </>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
      </div>
    </div>
  );
}
