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
});
