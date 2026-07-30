import { create } from "zustand";

export interface RecentFile {
  path: string;
  name: string;
  tool: string;
  timestamp: number;
  route?: string;
  sourcePath?: string;
}

export type ToastKind = "info" | "success" | "error";
export type JobStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface AppJob {
  id: string;
  tool: string;
  route: string;
  inputName?: string;
  startedAt: number;
  completedAt?: number;
  status: JobStatus;
  total: number;
  completed: number;
  failed: number;
  progress: number | null;
  message?: string;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface AppState {
  theme: "light" | "dark" | "system";
  recentFiles: RecentFile[];
  jobs: AppJob[];
  outputDir: string;
  toasts: Toast[];
  setTheme: (theme: "light" | "dark" | "system") => void;
  addRecentFile: (file: RecentFile) => void;
  removeRecentFile: (path: string) => void;
  beginJob: (job: AppJob) => void;
  updateJob: (id: string, update: Partial<Omit<AppJob, "id">>) => void;
  finishJob: (id: string, status: Exclude<JobStatus, "running">, message?: string) => void;
  clearFinishedJobs: () => void;
  setOutputDir: (dir: string) => void;
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

function readTheme(): AppState["theme"] {
  const value = localStorage.getItem("theme");
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function readRecentFiles(): RecentFile[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("recentFiles") || "[]");
    return Array.isArray(value)
      ? value.filter(
          (file): file is RecentFile =>
            typeof file === "object" &&
            file !== null &&
            typeof file.path === "string" &&
            typeof file.name === "string" &&
            typeof file.tool === "string" &&
            typeof file.timestamp === "number" &&
            (file.route === undefined || typeof file.route === "string") &&
            (file.sourcePath === undefined || typeof file.sourcePath === "string"),
        ).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

export const useAppStore = create<AppState>((set) => ({
  theme: readTheme(),
  recentFiles: readRecentFiles(),
  jobs: [],
  outputDir: localStorage.getItem("outputDir") || "",
  toasts: [],

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
    applyTheme(theme);
  },

  addRecentFile: (file) =>
    set((state) => {
      const updated = [file, ...state.recentFiles.filter((f) => f.path !== file.path)].slice(0, 20);
      localStorage.setItem("recentFiles", JSON.stringify(updated));
      return { recentFiles: updated };
    }),

  removeRecentFile: (path) =>
    set((state) => {
      const recentFiles = state.recentFiles.filter((file) => file.path !== path);
      localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
      return { recentFiles };
    }),

  beginJob: (job) =>
    set((state) => ({
      jobs: [job, ...state.jobs.filter((item) => item.id !== job.id)].slice(0, 20),
    })),

  updateJob: (id, update) =>
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...update } : job)),
    })),

  finishJob: (id, status, message) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id
          ? {
              ...job,
              status,
              message,
              completedAt: Date.now(),
              progress: status === "succeeded" ? 100 : job.progress,
            }
          : job,
      ),
    })),

  clearFinishedJobs: () =>
    set((state) => ({ jobs: state.jobs.filter((job) => job.status === "running") })),

  setOutputDir: (dir) => {
    localStorage.setItem("outputDir", dir);
    set({ outputDir: dir });
  },

  pushToast: (kind, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++toastCounter, kind, message }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Apply theme on load, and re-apply when the OS theme changes while in "system" mode.
applyTheme(useAppStore.getState().theme);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (useAppStore.getState().theme === "system") {
    applyTheme("system");
  }
});
