import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronUp,
  CircleX,
  FolderOpen,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore, type AppJob } from "../../stores/appStore";
import { getDirName } from "../../lib/utils";

async function openLocalPath(path: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(path);
}

function statusIcon(job: AppJob) {
  if (job.status === "running") return <Activity size={13} />;
  if (job.status === "succeeded") return <Check size={13} />;
  if (job.status === "cancelled") return <X size={13} />;
  return <CircleX size={13} />;
}

function jobSummary(job: AppJob): string {
  if (job.status === "running") {
    return job.total > 1
      ? `${job.completed} / ${job.total}`
      : job.progress === null
        ? "Working"
        : `${Math.round(job.progress)}%`;
  }
  if (job.status === "succeeded") return "Done";
  if (job.status === "cancelled") return "Cancelled";
  return job.message ?? "Failed";
}

export function JobTray() {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const jobs = useAppStore((state) => state.jobs);
  const clearFinishedJobs = useAppStore((state) => state.clearFinishedJobs);
  const pushToast = useAppStore((state) => state.pushToast);
  if (jobs.length === 0) return null;

  const activeCount = jobs.filter((job) => job.status === "running").length;
  const latest = jobs.find((job) => job.status === "running") ?? jobs[0];
  const openPath = (path: string) => {
    void openLocalPath(path).catch((error) => {
      pushToast("error", error instanceof Error ? error.message : String(error));
    });
  };

  return (
    <section
      aria-label="Jobs"
      aria-live="polite"
      className="shrink-0 border-t border-border bg-bg-secondary"
    >
      {expanded && (
        <div className="max-h-44 overflow-y-auto border-b border-border-subtle">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center border-b border-border-subtle last:border-b-0 hover:bg-bg-tertiary"
            >
              <button
                type="button"
                onClick={() => navigate(job.route)}
                className="grid min-w-0 flex-1 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2 text-left"
              >
                <span
                  className={job.status === "failed" ? "text-danger" : "text-text-secondary"}
                >
                  {statusIcon(job)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-text">
                    {job.tool}
                  </span>
                  {job.inputName && (
                    <span className="block truncate text-[10px] text-text-muted">
                      {job.inputName}
                    </span>
                  )}
                </span>
                <span className="max-w-56 truncate font-mono text-[10px] text-text-secondary">
                  {jobSummary(job)}
                </span>
              </button>
              {job.status === "succeeded" && job.outputPath && (
                <div className="flex shrink-0 items-center pr-2">
                  <button
                    type="button"
                    title="Open output"
                    aria-label={`Open ${job.tool} output`}
                    onClick={() => openPath(job.outputPath!)}
                    className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                  <button
                    type="button"
                    title="Open containing folder"
                    aria-label={`Open folder containing ${job.tool} output`}
                    onClick={() => openPath(getDirName(job.outputPath!))}
                    className="inline-flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
                  >
                    <FolderOpen size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex h-10 items-center gap-3 px-4">
        <Activity
          size={14}
          className={activeCount > 0 ? "text-accent-signal" : "text-text-muted"}
        />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className="text-[11px] font-semibold uppercase text-text">
            {activeCount > 0 ? `${activeCount} active` : "Recent jobs"}
          </span>
          <span className="truncate text-[11px] text-text-muted">
            {latest.tool} · {jobSummary(latest)}
          </span>
          <ChevronUp
            size={13}
            className={`ml-auto text-text-muted ${expanded ? "" : "rotate-180"}`}
          />
        </button>
        {jobs.some((job) => job.status !== "running") && (
          <button
            type="button"
            title="Clear completed jobs"
            aria-label="Clear completed jobs"
            onClick={clearFinishedJobs}
            className="inline-flex h-7 w-7 items-center justify-center text-text-muted hover:text-text"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </section>
  );
}
