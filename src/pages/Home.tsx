import { useMemo, useState } from "react";
import { ArrowUpRight, FileText, FolderOpen, RotateCcw, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/appStore";
import { TOOLS, type ToolSpec } from "../lib/tools";
import { getDirName } from "../lib/utils";

type Category = ToolSpec["category"];

interface CategoryMeta {
  label: string;
  accent: string;
  tagline: string;
}

const CATEGORIES: Category[] = ["image", "video", "pdf", "audio"];

const CAT_META: Record<Category, CategoryMeta> = {
  image: {
    label: "Image",
    accent: "var(--color-accent-gold)",
    tagline: "Resize, crop, convert, adjust",
  },
  video: {
    label: "Video",
    accent: "var(--color-accent-steel)",
    tagline: "Trim, transcode, condense",
  },
  pdf: {
    label: "PDF",
    accent: "var(--color-accent-signal)",
    tagline: "Merge, compress, organize",
  },
  audio: {
    label: "Audio",
    accent: "var(--color-accent-sage)",
    tagline: "Trim, fade, convert",
  },
};

function groupByCategory(): Record<Category, ToolSpec[]> {
  const grouped: Record<Category, ToolSpec[]> = {
    image: [],
    video: [],
    pdf: [],
    audio: [],
  };
  for (const tool of TOOLS) grouped[tool.category].push(tool);
  return grouped;
}

function ToolRow({ tool, accent, onClick }: { tool: ToolSpec; accent: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid w-full grid-cols-12 items-baseline gap-4 border-b border-border-subtle px-1 py-3.5 text-left hover:bg-bg-tertiary"
    >
      <span className="col-span-4 text-[15px] font-medium text-text">{tool.label}</span>
      <span className="col-span-7 text-[13px] leading-snug text-text-secondary">
        {tool.description}
      </span>
      <ArrowUpRight
        size={15}
        className="col-span-1 ml-auto transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        style={{ color: accent }}
      />
    </button>
  );
}

async function openLocalPath(path: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(path);
}

export function Home() {
  const navigate = useNavigate();
  const recentFiles = useAppStore((state) => state.recentFiles);
  const removeRecentFile = useAppStore((state) => state.removeRecentFile);
  const pushToast = useAppStore((state) => state.pushToast);
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => groupByCategory(), []);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return TOOLS.filter((tool) =>
      `${tool.label} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const openPath = (path: string) => {
    void openLocalPath(path).catch((error) => {
      pushToast("error", error instanceof Error ? error.message : String(error));
    });
  };

  return (
    <div>
      <header className="animate-fade-in-up mb-5 grid grid-cols-12 gap-6 border-b border-border pb-5">
        <div className="col-span-9">
          <h1
            className="text-[42px] font-bold uppercase leading-[0.92] text-text"
            style={{ fontFamily: "var(--font-display)", letterSpacing: 0 }}
          >
            Edit media. Locally.
          </h1>
          <p className="mt-3 max-w-[66ch] text-[13px] leading-relaxed text-text-secondary">
            Private desktop tools for image, video, audio, and PDF. No cloud round-trip.
          </p>
        </div>
        <div className="col-span-3 border-l border-border pl-5">
          <div className="swiss-label">Available</div>
          <div className="mt-1 font-mono text-[30px] leading-none text-text">
            {String(TOOLS.length).padStart(2, "0")}
          </div>
        </div>
      </header>

      <section className="mb-5" aria-label="Find a tool">
        <label className="sr-only" htmlFor="tool-search">
          Find a tool
        </label>
        <div className="flex h-11 items-center border border-border bg-bg-secondary px-3 focus-within:border-text">
          <Search size={15} className="mr-3 shrink-0 text-text-muted" />
          <input
            id="tool-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a tool by action or file type"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="px-2 text-[11px] font-semibold uppercase text-text-muted hover:text-text"
            >
              Clear
            </button>
          )}
        </div>

        {query.trim() && (
          <div className="border-x border-b border-border bg-bg-secondary">
            {results.length > 0 ? (
              results.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  accent={CAT_META[tool.category].accent}
                  onClick={() => navigate(tool.route)}
                />
              ))
            ) : (
              <p className="px-4 py-4 text-[13px] text-text-muted">No matching tools.</p>
            )}
          </div>
        )}
      </section>

      <nav
        className="mb-7 grid grid-cols-4 border border-border bg-bg-secondary"
        aria-label="Tool categories"
      >
        {CATEGORIES.map((category, index) => {
          const meta = CAT_META[category];
          const items = grouped[category];
          return (
            <button
              key={category}
              type="button"
              onClick={() =>
                document.getElementById(`section-${category}`)?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                  block: "start",
                })
              }
              className={`min-h-[86px] px-4 py-3 text-left hover:bg-bg-tertiary ${
                index > 0 ? "border-l border-border" : ""
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase text-text">{meta.label}</span>
                <span
                  className="h-2.5 w-2.5"
                  style={{ background: meta.accent }}
                  aria-hidden="true"
                />
              </span>
              <span className="mt-2 block text-[11px] leading-snug text-text-secondary">
                {meta.tagline}
              </span>
              <span className="mt-1 block font-mono text-[10px] text-text-muted">
                {items.length} {items.length === 1 ? "tool" : "tools"}
              </span>
            </button>
          );
        })}
      </nav>

      {recentFiles.length > 0 && (
        <section className="animate-fade-in-up mb-8" aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between border-b border-border pb-2.5">
            <h2 id="recent-heading" className="text-[17px] font-bold uppercase text-text">
              Recent outputs
            </h2>
            <span className="swiss-label">{Math.min(recentFiles.length, 5)} shown</span>
          </div>
          <div>
            {recentFiles.slice(0, 5).map((file) => (
              <div
                key={file.path}
                className="grid min-h-11 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border-subtle px-1 hover:bg-bg-tertiary"
              >
                <FileText size={13} className="text-text-muted" />
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-text" title={file.path}>
                    {file.name}
                  </div>
                  <div className="truncate text-[10px] uppercase text-text-muted">{file.tool}</div>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    title="Open output"
                    aria-label={`Open ${file.name}`}
                    onClick={() => openPath(file.path)}
                    className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    title="Open containing folder"
                    aria-label={`Open folder containing ${file.name}`}
                    onClick={() => openPath(getDirName(file.path))}
                    className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
                  >
                    <FolderOpen size={13} />
                  </button>
                  {file.route && file.sourcePath && (
                    <button
                      type="button"
                      title="Use this tool again"
                      aria-label={`Use ${file.tool} again`}
                      onClick={() =>
                        navigate(`${file.route}?file=${encodeURIComponent(file.sourcePath!)}`)
                      }
                      className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove from recent outputs"
                    aria-label={`Remove ${file.name} from recent outputs`}
                    onClick={() => removeRecentFile(file.path)}
                    className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="animate-fade-in-up mb-3 flex items-baseline justify-between">
        <span className="swiss-label">All tools</span>
      </div>

      {CATEGORIES.map((category) => {
        const meta = CAT_META[category];
        const items = grouped[category];
        return (
          <section
            key={category}
            id={`section-${category}`}
            className="animate-fade-in-up mb-10 scroll-mt-6"
          >
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="flex items-baseline gap-3">
                <span
                  className="inline-block h-2.5 w-2.5"
                  style={{ background: meta.accent }}
                  aria-hidden="true"
                />
                <h2 className="text-[22px] font-bold uppercase text-text">{meta.label}</h2>
              </div>
              <span className="swiss-label">{items.length}</span>
            </div>
            {items.map((tool) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                accent={meta.accent}
                onClick={() => navigate(tool.route)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
