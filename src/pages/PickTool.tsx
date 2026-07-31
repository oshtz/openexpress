import { useNavigate, useSearchParams } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { type ToolSpec, toolsForPath, extensionOf } from "../lib/tools";
import { CATEGORY_META } from "../lib/tool-icons";
import { getFileName } from "../lib/utils";

type Category = keyof typeof CATEGORY_META;

/** Category accent — mirrors Home / Sidebar / ToolPage mapping. */
const ACCENT: Record<Category, string> = {
  image: "var(--color-accent-gold)",
  video: "var(--color-accent-steel)",
  pdf: "var(--color-accent-signal)",
  audio: "var(--color-accent-sage)",
};

export function PickTool() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const file = params.get("file");

  if (!file) {
    // Shouldn't happen via the launch flow, but render something useful if a
    // user navigates here directly.
    return (
      <div className="max-w-2xl mx-auto text-center py-12 animate-fade-in-up">
        <HelpCircle className="text-text-muted mx-auto mb-3" size={32} />
        <h1 className="text-[18px] font-semibold text-text mb-1">No file to pick a tool for</h1>
        <p className="text-[13px] text-text-secondary">
          Open this page by right-clicking a file in your file manager, or pick a tool from
          the Home screen.
        </p>
      </div>
    );
  }

  const filename = getFileName(file);
  const ext = extensionOf(file);
  const tools = toolsForPath(file);

  const launch = (tool: ToolSpec) => {
    navigate(`${tool.route}?file=${encodeURIComponent(file)}`);
  };

  if (tools.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 animate-fade-in-up">
        <HelpCircle className="text-text-muted mx-auto mb-3" size={32} />
        <h1 className="text-[18px] font-semibold text-text mb-1">
          No tools support .{ext || "this file"}
        </h1>
        <p className="text-[13px] text-text-secondary break-all">{filename}</p>
        <p className="text-[12px] text-text-muted mt-2">
          OpenExpress supports JPG, PNG, WebP, BMP, TIFF, MP4, WebM, AVI, MOV, MKV, and PDF.
        </p>
      </div>
    );
  }

  // Group by category so the cascading "Image / Video / PDF" structure
  // mirrors the home page when applicable.
  const byCategory: Record<string, ToolSpec[]> = {};
  for (const t of tools) {
    (byCategory[t.category] ||= []).push(t);
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <header className="mb-8 border-b border-border pb-6">
        <div className="swiss-label">Pick a tool</div>
        <h1
          className="swiss-display break-all mt-2"
          style={{
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: 0,
            lineHeight: 1.05,
            color: "var(--color-text)",
          }}
        >
          {filename}
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          .{ext} · {tools.length} tool{tools.length === 1 ? "" : "s"} available
        </p>
      </header>

      {(Object.keys(byCategory) as Category[]).map((category) => {
        const meta = CATEGORY_META[category];
        const accent = ACCENT[category];
        return (
          <div key={category} className="mb-10">
            <div className="flex items-baseline justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    background: accent,
                    transform: "translateY(1px)",
                    display: "inline-block",
                  }}
                />
                <h2
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    letterSpacing: 0,
                    textTransform: "uppercase",
                    color: "var(--color-text)",
                  }}
                >
                  {meta.label}
                </h2>
              </div>
              <span className="swiss-label">
                {byCategory[category].length}{" "}
                {byCategory[category].length === 1 ? "tool" : "tools"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {byCategory[category].map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => launch(tool)}
                  className="swiss-card animate-fade-in-up group relative flex flex-col text-left transition-colors"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <div style={{ height: 3, background: accent }} aria-hidden />
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: "var(--card-ink)" }}
                      >
                        {tool.label}
                      </span>
                      <span
                        className="transition-transform group-hover:translate-x-1"
                        style={{ color: accent, fontSize: 16, lineHeight: 1 }}
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                    <span
                      className="text-[12px] leading-snug mt-1 block"
                      style={{ color: "var(--card-ghost)" }}
                    >
                      {tool.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
