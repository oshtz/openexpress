import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, FileText, FolderOpen, RotateCcw, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FileDropzone } from "../components/common/FileDropzone";
import { useAppStore } from "../stores/appStore";
import { TOOLS, type ToolSpec } from "../lib/tools";
import { getDirName } from "../lib/utils";

type Category = ToolSpec["category"];

interface CategoryMeta {
  label: string;
  accent: string;
}

const CATEGORIES: Category[] = ["image", "video", "pdf", "audio"];

const CAT_META: Record<Category, CategoryMeta> = {
  image: {
    label: "Image",
    accent: "var(--color-accent-gold)",
  },
  video: {
    label: "Video",
    accent: "var(--color-accent-steel)",
  },
  pdf: {
    label: "PDF",
    accent: "var(--color-accent-signal)",
  },
  audio: {
    label: "Audio",
    accent: "var(--color-accent-sage)",
  },
};

const SUPPORTED_EXTENSIONS = [...new Set(TOOLS.flatMap((tool) => tool.extensions))];

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

function ToolRow({
  tool,
  accent,
  onClick,
  displayLabel = tool.label,
  optionId,
  selected = false,
}: {
  tool: ToolSpec;
  accent: string;
  onClick: () => void;
  displayLabel?: string;
  optionId?: string;
  selected?: boolean;
}) {
  return (
    <button
      id={optionId}
      type="button"
      role={optionId ? "option" : undefined}
      aria-selected={optionId ? selected : undefined}
      onClick={onClick}
      className={`group grid w-full grid-cols-12 items-baseline gap-4 border-b border-border-subtle px-3 py-3.5 text-left hover:bg-bg-tertiary ${
        selected ? "bg-bg-tertiary" : ""
      }`}
    >
      <span className="col-span-4 text-[15px] font-medium text-text">{displayLabel}</span>
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
  const [activeResult, setActiveResult] = useState(-1);
  const grouped = useMemo(() => groupByCategory(), []);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return TOOLS.filter((tool) =>
      `${tool.label} ${tool.description} ${tool.category}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const hasQuery = query.trim().length > 0;

  const openPath = (path: string) => {
    void openLocalPath(path).catch((error) => {
      pushToast("error", error instanceof Error ? error.message : String(error));
    });
  };

  const openTool = (tool: ToolSpec) => navigate(tool.route);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      openTool(results[activeResult >= 0 ? activeResult : 0]);
    }
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

      <section className="mb-5" aria-labelledby="start-file-heading">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="start-file-heading" className="text-[17px] font-bold uppercase text-text">
            Start with a file
          </h2>
          <span className="swiss-label">Local only</span>
        </div>
        <FileDropzone
          compact
          accept={SUPPORTED_EXTENSIONS}
          label="Drop a file to see compatible tools"
          onFiles={([path]) => {
            if (path) navigate(`/pick?file=${encodeURIComponent(path)}`);
          }}
        />
      </section>

      <section className="mb-5" aria-label="Find a tool">
        <label className="sr-only" htmlFor="tool-search">
          Find a tool
        </label>
        <div className="flex h-11 items-center border border-border bg-bg-secondary px-3 focus-within:border-text">
          <Search size={15} className="mr-3 shrink-0 text-text-muted" />
          <input
            id="tool-search"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasQuery}
            aria-controls={hasQuery ? "tool-search-results" : undefined}
            aria-activedescendant={
              activeResult >= 0 ? `tool-search-result-${results[activeResult]?.id}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveResult(-1);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find a tool by action or file type"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveResult(-1);
              }}
              className="px-2 text-[11px] font-semibold uppercase text-text-muted hover:text-text"
            >
              Clear
            </button>
          )}
        </div>

        <p role="status" className="sr-only">
          {hasQuery
            ? `${results.length} matching ${results.length === 1 ? "tool" : "tools"}`
            : ""}
        </p>

        {hasQuery && (
          <div className="border-x border-b border-border bg-bg-secondary">
            <div className="border-b border-border-subtle px-3 py-2 font-mono text-[10px] uppercase text-text-muted">
              {results.length} {results.length === 1 ? "result" : "results"}
            </div>
            <div id="tool-search-results" role="listbox">
              {results.map((tool, index) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  optionId={`tool-search-result-${tool.id}`}
                  selected={index === activeResult}
                  displayLabel={`${tool.label} ${CAT_META[tool.category].label}`}
                  accent={CAT_META[tool.category].accent}
                  onClick={() => openTool(tool)}
                />
              ))}
            </div>
            {results.length === 0 && (
              <p className="px-4 py-4 text-[13px] text-text-muted">No matching tools.</p>
            )}
          </div>
        )}
      </section>

      {!hasQuery && recentFiles.length > 0 && (
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

      {!hasQuery && (
        <>
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
                    onClick={() => openTool(tool)}
                  />
                ))}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
