import { useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/appStore";
import { TOOLS, type ToolSpec } from "../lib/tools";

type Category = ToolSpec["category"];

interface CategoryMeta {
  label: string;
  accent: string;
  accentInk: string;
  tagline: string;
}

const CATEGORIES: Category[] = ["image", "video", "pdf", "audio"];

const CAT_META: Record<Category, CategoryMeta> = {
  image: {
    label: "Image",
    accent: "var(--color-accent-gold)",
    accentInk: "var(--color-ink-on-gold)",
    tagline: "Resize, crop, convert, and adjust.",
  },
  video: {
    label: "Video",
    accent: "var(--color-accent-steel)",
    accentInk: "var(--color-ink-on-steel)",
    tagline: "Trim, transcode, and condense.",
  },
  pdf: {
    label: "PDF",
    accent: "var(--color-accent-signal)",
    accentInk: "var(--color-ink-on-signal)",
    tagline: "Merge, compress, convert.",
  },
  audio: {
    label: "Audio",
    accent: "var(--color-accent-sage)",
    accentInk: "var(--color-ink-on-sage)",
    tagline: "Trim, fade, convert.",
  },
};

function groupByCategory(): Record<Category, ToolSpec[]> {
  const out: Record<Category, ToolSpec[]> = { image: [], video: [], pdf: [], audio: [] };
  for (const tool of TOOLS) out[tool.category].push(tool);
  return out;
}

function ToolRow({
  tool,
  accent,
  onClick,
}: {
  tool: ToolSpec;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full grid grid-cols-12 gap-4 items-baseline text-left border-b border-border-subtle hover:bg-bg-tertiary transition-colors"
      style={{ padding: "18px 4px" }}
    >
      <span
        className="col-span-4"
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: "var(--color-text)",
        }}
      >
        {tool.label}
      </span>
      <span
        className="col-span-7"
        style={{
          fontSize: 14,
          lineHeight: 1.4,
          color: "var(--color-text-secondary)",
        }}
      >
        {tool.description}
      </span>
      <span
        className="col-span-1 text-right pr-2 transition-transform group-hover:translate-x-1"
        style={{ color: accent, fontSize: 20, lineHeight: 1 }}
      >
        -&gt;
      </span>
    </button>
  );
}

export function Home() {
  const navigate = useNavigate();
  const recentFiles = useAppStore((s) => s.recentFiles);
  const grouped = groupByCategory();

  return (
    <div>
      <header className="animate-fade-in-up grid grid-cols-12 gap-8 border-b border-border pb-10 mb-12">
        <div className="col-span-12 md:col-span-8">
          <h1
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: "clamp(2.6rem, 6vw, 5.2rem)",
              lineHeight: 0.9,
              textTransform: "uppercase",
              color: "var(--color-text)",
            }}
          >
            Edit media.
            <br />
            Locally.
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--color-text-secondary)",
              maxWidth: "54ch",
              marginTop: 24,
            }}
          >
            Fast, private tools for image, video, audio, and PDF. Everything runs
            on your machine. No cloud. No subscription. No tracking.
          </p>
        </div>

        <aside className="col-span-12 md:col-span-4 md:border-l md:border-border md:pl-8 flex flex-col justify-between">
          <div>
            <div className="swiss-label">Tools available</div>
            <div className="numeral-outline mt-2" style={{ fontSize: "7rem", lineHeight: 0.85 }}>
              {String(TOOLS.length).padStart(2, "0")}
            </div>
          </div>
        </aside>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 border border-border mb-12">
        {CATEGORIES.map((cat, idx) => {
          const meta = CAT_META[cat];
          const items = grouped[cat];
          return (
            <button
              key={cat}
              type="button"
              aria-label={`Jump to ${meta.label}`}
              onClick={() => {
                const reduceMotion = window.matchMedia(
                  "(prefers-reduced-motion: reduce)",
                ).matches;
                document.getElementById(`section-${cat}`)?.scrollIntoView({
                  behavior: reduceMotion ? "auto" : "smooth",
                  block: "start",
                });
              }}
              className={`animate-fade-in-up relative px-8 py-10 pb-36 text-left transition-opacity hover:opacity-90 ${idx > 0 ? "md:border-l border-border border-t md:border-t-0" : ""}`}
              style={{
                background: meta.accent,
                color: meta.accentInk,
                minHeight: 240,
                animationDelay: `${60 + idx * 50}ms`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: meta.accentInk,
                  opacity: 0.7,
                }}
              >
                {meta.label}
              </div>

              <div
                className="mt-2"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 24,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  maxWidth: "22ch",
                }}
              >
                {meta.tagline}
              </div>

              <div
                className="absolute left-8 right-8 bottom-10 flex items-end justify-between pt-6"
                style={{ borderTop: `1px solid ${meta.accentInk}`, opacity: 0.85 }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 400,
                    fontSize: 72,
                    lineHeight: 0.85,
                    color: "transparent",
                    WebkitTextStroke: `1.5px ${meta.accentInk}`,
                  }}
                >
                  {String(items.length).padStart(2, "0")}
                </div>
                <div
                  style={{
                    color: meta.accentInk,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textAlign: "right",
                    lineHeight: 1.5,
                  }}
                >
                  {items.length === 1 ? "tool" : "tools"}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <div className="animate-fade-in-up flex items-baseline justify-between mb-6">
        <span className="swiss-label">All tools</span>
      </div>

      {CATEGORIES.map((cat) => {
        const meta = CAT_META[cat];
        const items = grouped[cat];
        if (items.length === 0) return null;

        return (
          <section
            key={cat}
            id={`section-${cat}`}
            className="animate-fade-in-up mb-14 scroll-mt-6"
          >
            <div className="flex items-baseline justify-between border-b border-border pb-4 mb-0">
              <div className="flex items-baseline gap-4">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    background: meta.accent,
                    transform: "translateY(1px)",
                    display: "inline-block",
                  }}
                />
                <h2
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 700,
                    fontSize: 28,
                    textTransform: "uppercase",
                    color: "var(--color-text)",
                  }}
                >
                  {meta.label}
                </h2>
              </div>
              <span className="swiss-label">
                {items.length} {items.length === 1 ? "tool" : "tools"}
              </span>
            </div>

            <div>
              {items.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  accent={meta.accent}
                  onClick={() => navigate(tool.route)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {recentFiles.length > 0 && (
        <section className="animate-fade-in-up mb-12">
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: 22,
                textTransform: "uppercase",
                color: "var(--color-text)",
              }}
            >
              Recent files
            </h2>
            <span className="swiss-label">{Math.min(recentFiles.length, 5)} entries</span>
          </div>

          <div>
            {recentFiles.slice(0, 5).map((file) => (
              <div
                key={file.path + file.timestamp}
                className="grid grid-cols-12 gap-4 items-baseline border-b border-border-subtle py-3 hover:bg-bg-tertiary transition-colors px-1"
              >
                <span
                  className="col-span-8 truncate"
                  style={{ fontSize: 14, color: "var(--color-text)" }}
                  title={file.path}
                >
                  {file.name}
                </span>
                <span
                  className="col-span-4 text-right pr-2"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {file.tool}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
