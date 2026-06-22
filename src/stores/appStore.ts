import { create } from "zustand";

export interface RecentFile {
  path: string;
  name: string;
  tool: string;
  timestamp: number;
}

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface AppState {
  theme: "light" | "dark" | "system";
  recentFiles: RecentFile[];
  outputDir: string;
  toasts: Toast[];
  setTheme: (theme: "light" | "dark" | "system") => void;
  addRecentFile: (file: RecentFile) => void;
  setOutputDir: (dir: string) => void;
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

export const useAppStore = create<AppState>((set) => ({
  theme:
    (localStorage.getItem("theme") as "light" | "dark" | "system") || "system",
  recentFiles: JSON.parse(localStorage.getItem("recentFiles") || "[]"),
  outputDir: "",
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

  setOutputDir: (dir) => set({ outputDir: dir }),

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
