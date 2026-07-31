import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import { ExternalLink, FolderOpen, RotateCcw, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AudioWaveform,
  FileText,
  Image as ImageIcon,
  Video,
} from "pixelarticons/react";
import { FileDropzone } from "../components/common/FileDropzone";
import { iconFor } from "../lib/tool-icons";
import { TOOLS, type ToolSpec } from "../lib/tools";
import { getDirName } from "../lib/utils";
import { useAppStore, type AppJob } from "../stores/appStore";

type Category = ToolSpec["category"];
type PixelIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORIES: { id: Category; label: string; icon: PixelIcon }[] = [
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "audio", label: "Audio", icon: AudioWaveform },
];

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map(({ id, label }) => [id, label]),
) as Record<Category, string>;

const SUPPORTED_EXTENSIONS = [...new Set(TOOLS.flatMap((tool) => tool.extensions))];

const SHORTCUTS: Record<string, string> = {
  "image-resize": "R",
  "image-crop": "C",
  "image-convert": "V",
  "image-compress": "P",
  "image-rotate": "O",
  "image-adjust": "A",
  "image-sharpen": "S",
  "image-blur": "B",
  "image-vector-trace": "T",
  "image-remove-bg": "G",
  "image-upscale": "U",
};

const DISPLAY_COPY: Record<string, string> = {
  "image-resize": "Change dimensions and scale",
  "image-crop": "Trim edges of the image",
  "image-convert": "Convert to another format",
  "image-compress": "Reduce file size",
  "image-rotate": "Rotate or flip orientation",
  "image-adjust": "Brightness, contrast, color",
  "image-sharpen": "Enhance edges and details",
  "image-blur": "Apply blur to the image",
  "image-vector-trace": "Vectorize to SVG format",
  "image-remove-bg": "Remove background",
  "image-upscale": "Enhance resolution with AI",
};

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="workbench-empty-copy">
      <span className="empty-index">00</span>
      <strong>{title}</strong>
      <small>{detail}</small>
    </div>
  );
}

function jobSummary(job: AppJob): string {
  if (job.status === "running") {
    if (job.total > 1) return `${job.completed} / ${job.total}`;
    return job.progress === null ? "Working" : `${Math.round(job.progress)}%`;
  }
  if (job.status === "succeeded") return "Done";
  if (job.status === "cancelled") return "Cancelled";
  return job.message ?? "Failed";
}

async function openLocalPath(path: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(path);
}

export function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const recentFiles = useAppStore((state) => state.recentFiles);
  const removeRecentFile = useAppStore((state) => state.removeRecentFile);
  const jobs = useAppStore((state) => state.jobs);
  const clearFinishedJobs = useAppStore((state) => state.clearFinishedJobs);
  const pushToast = useAppStore((state) => state.pushToast);
  const [category, setCategory] = useState<Category>("image");
  const [filter, setFilter] = useState("");
  const [activeResult, setActiveResult] = useState(-1);
  const filterRef = useRef<HTMLInputElement>(null);
  const view = params.get("view") || "open";
  const hasFilter = filter.trim().length > 0;

  const tools = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      if (!query && tool.category !== category) return false;
      const copy = DISPLAY_COPY[tool.id] ?? tool.description;
      return !query || `${tool.label} ${copy} ${tool.category}`.toLowerCase().includes(query);
    });
  }, [category, filter]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable=true]")) return;

      if (event.key === "/") {
        event.preventDefault();
        filterRef.current?.focus();
        return;
      }

      if (category !== "image" || event.ctrlKey || event.metaKey || event.altKey) return;
      const tool = TOOLS.find(
        (candidate) => SHORTCUTS[candidate.id]?.toLowerCase() === event.key.toLowerCase(),
      );
      if (tool) navigate(tool.route);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [category, navigate]);

  const openPath = (path: string) => {
    void openLocalPath(path).catch((error) => {
      pushToast("error", error instanceof Error ? error.message : String(error));
    });
  };

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (tools.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((current) => (current + 1) % tools.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((current) => (current <= 0 ? tools.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(tools[activeResult >= 0 ? activeResult : 0].route);
    }
  };

  return (
    <div className="workbench" aria-label="OpenExpress workbench">
      <h1 className="sr-only">Edit media locally</h1>

      <section className="workbench-canvas" aria-label={`${view} workspace`}>
        {view === "open" && (
          <FileDropzone
            variant="workbench"
            accept={SUPPORTED_EXTENSIONS}
            label="Drop file or press Ctrl+O"
            onFiles={(paths) => {
              if (paths[0]) navigate(`/pick?file=${encodeURIComponent(paths[0])}`);
            }}
          />
        )}

        {view === "recent" && (
          <div className="recent-panel">
            <div className="panel-heading">
              <span>Recent outputs</span>
              <span>{String(recentFiles.length).padStart(2, "0")} entries</span>
            </div>
            {recentFiles.length === 0 ? (
              <EmptyState title="No recent outputs" detail="Complete a task to start local history" />
            ) : (
              <div className="recent-list">
                {recentFiles.slice(0, 20).map((file, index) => (
                  <div key={`${file.path}-${file.timestamp}`} className="recent-row">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong title={file.path}>{file.name}</strong>
                    <small>{file.tool}</small>
                    <div className="recent-actions">
                      <button
                        type="button"
                        title="Open output"
                        aria-label={`Open ${file.name}`}
                        onClick={() => openPath(file.path)}
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        type="button"
                        title="Open containing folder"
                        aria-label={`Open folder containing ${file.name}`}
                        onClick={() => openPath(getDirName(file.path))}
                      >
                        <FolderOpen size={14} />
                      </button>
                      {file.route && file.sourcePath && (
                        <button
                          type="button"
                          title="Use this tool again"
                          aria-label={`Use ${file.tool} again`}
                          onClick={() =>
                            navigate(`${file.route}?file=${encodeURIComponent(file.sourcePath!)}`)
                          }
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remove from recent outputs"
                        aria-label={`Remove ${file.name} from recent outputs`}
                        onClick={() => removeRecentFile(file.path)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "queue" && (
          <div className="recent-panel">
            <div className="panel-heading">
              <span>Queue</span>
              {jobs.some((job) => job.status !== "running") ? (
                <button type="button" onClick={clearFinishedJobs}>Clear finished</button>
              ) : (
                <span>{String(jobs.length).padStart(2, "0")} jobs</span>
              )}
            </div>
            {jobs.length === 0 ? (
              <EmptyState title="Queue empty" detail="Processed tasks will appear here" />
            ) : (
              <div className="recent-list">
                {jobs.map((job, index) => (
                  <button
                    type="button"
                    key={job.id}
                    className="queue-row"
                    onClick={() => navigate(job.route)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{job.tool}</strong>
                    <small>{jobSummary(job)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="actions-console" aria-label="Actions">
        <div className="actions-title">Actions</div>

        <div className="tool-filter">
          <label className="sr-only" htmlFor="tool-filter-input">Find a tool</label>
          <input
            id="tool-filter-input"
            ref={filterRef}
            value={filter}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={hasFilter}
            aria-controls={hasFilter ? "tool-search-results" : undefined}
            aria-activedescendant={
              activeResult >= 0 ? `tool-search-result-${tools[activeResult]?.id}` : undefined
            }
            onChange={(event) => {
              setFilter(event.target.value);
              setActiveResult(-1);
            }}
            onKeyDown={handleFilterKeyDown}
            placeholder="FILTER"
          />
          <kbd>/</kbd>
        </div>

        <p role="status" className="sr-only">
          {hasFilter ? `${tools.length} matching ${tools.length === 1 ? "tool" : "tools"}` : ""}
        </p>

        <div className="category-switcher" role="radiogroup" aria-label="Tool category">
          {CATEGORIES.map((item) => {
            const Icon = item.icon;
            const active = item.id === category;
            return (
              <button
                type="button"
                key={item.id}
                role="radio"
                aria-checked={active}
                aria-label={`${item.label} tools`}
                className={active ? "active" : ""}
                onClick={() => {
                  setCategory(item.id);
                  setActiveResult(-1);
                }}
              >
                <Icon width={52} height={52} aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="tool-list-heading">
          <span>{hasFilter ? "search results" : `${category} tools`}</span>
          <span>{String(tools.length).padStart(2, "0")}</span>
        </div>

        <div
          className="console-tool-list"
          id={hasFilter ? "tool-search-results" : undefined}
          role={hasFilter ? "listbox" : undefined}
        >
          {tools.map((tool, index) => (
            <button
              type="button"
              key={tool.id}
              id={hasFilter ? `tool-search-result-${tool.id}` : undefined}
              role={hasFilter ? "option" : undefined}
              aria-selected={hasFilter ? index === activeResult : undefined}
              className={hasFilter && index === activeResult ? "active" : ""}
              onMouseEnter={() => hasFilter && setActiveResult(index)}
              onClick={() => navigate(tool.route)}
            >
              <span className="tool-icon" aria-hidden>{iconFor(tool.id, 28)}</span>
              <span className="tool-name">
                {hasFilter ? `${tool.label} ${CATEGORY_LABELS[tool.category]}` : tool.label}
              </span>
              <span className="tool-description">{DISPLAY_COPY[tool.id] ?? tool.description}</span>
              {SHORTCUTS[tool.id] && <kbd>[{SHORTCUTS[tool.id]}]</kbd>}
            </button>
          ))}
          {tools.length === 0 && <div className="no-tool-results">No matching commands</div>}
        </div>
      </aside>
    </div>
  );
}
