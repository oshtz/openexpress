import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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

  // Kept for existing callers; the shared header uses the category accent.
  void icon;

  const hasGrid = Boolean(controls);
  const inputReady = Boolean(preview);
  const settingsStatus = inputReady ? "Ready to process" : "Choose a file to continue";

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
              <div className="flex items-center justify-between border-t border-border-subtle px-6 py-3 md:border-l md:border-t-0">
                <span className="swiss-label">
                  <span style={{ fontFamily: "var(--font-mono)", marginRight: 8 }}>02</span>
                  Settings
                </span>
                <span className="font-mono text-[10px] uppercase text-text-muted">
                  {inputReady ? "Ready" : "Waiting"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="relative min-h-[320px] p-6">
                {inputReady && onClear && (
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
                {inputReady ? preview : upload}
              </div>

              <div
                className={`tool-controls border-t border-border-subtle p-6 md:border-l md:border-t-0 ${
                  inputReady ? "" : "bg-bg-tertiary/40"
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
                  className={`min-w-0 border-0 p-0 ${inputReady ? "" : "opacity-50"}`}
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
  );
}
