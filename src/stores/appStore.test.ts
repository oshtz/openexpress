import { beforeEach, describe, expect, it, vi } from "vitest";

describe("appStore persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("persists the default output directory", async () => {
    const { useAppStore } = await import("./appStore");
    useAppStore.getState().setOutputDir("C:\\Exports");

    expect(localStorage.getItem("outputDir")).toBe("C:\\Exports");
    expect(useAppStore.getState().outputDir).toBe("C:\\Exports");
  });

  it("recovers from malformed recent-file storage", async () => {
    localStorage.setItem("recentFiles", "{not json");
    const { useAppStore } = await import("./appStore");

    expect(useAppStore.getState().recentFiles).toEqual([]);
  });

  it("keeps running jobs when completed jobs are cleared", async () => {
    const { useAppStore } = await import("./appStore");
    const baseJob = {
      tool: "Resize",
      route: "/image/resize",
      startedAt: 1,
      status: "running" as const,
      total: 1,
      completed: 0,
      failed: 0,
      progress: null,
    };

    useAppStore.getState().beginJob({ ...baseJob, id: "done" });
    useAppStore.getState().finishJob("done", "succeeded");
    useAppStore.getState().beginJob({ ...baseJob, id: "active" });
    useAppStore.getState().clearFinishedJobs();

    expect(useAppStore.getState().jobs.map((job) => job.id)).toEqual(["active"]);
  });
});
