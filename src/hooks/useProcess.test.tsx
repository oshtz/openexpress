import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../stores/appStore";
import { useProcess } from "./useProcess";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  Channel: class {
    onmessage: ((value: number) => void) | null = null;
  },
}));

describe("useProcess jobs", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useAppStore.setState({ jobs: [], recentFiles: [], toasts: [] });
    window.history.replaceState({}, "", "/image/resize");
  });

  it("completes a global job and records a reusable output", async () => {
    invokeMock.mockResolvedValue({ output_path: "C:\\Exports\\photo-resized.png" });
    const { result } = renderHook(() =>
      useProcess<{ output_path: string }>({ tool: "Resize Image" }),
    );

    await act(async () => {
      await result.current.run("resize_image", {
        inputPath: "C:\\Photos\\photo.png",
      });
    });

    const { jobs, recentFiles } = useAppStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      tool: "Resize Image",
      route: "/image/resize",
      status: "succeeded",
      completed: 1,
      failed: 0,
    });
    expect(recentFiles[0]).toMatchObject({
      path: "C:\\Exports\\photo-resized.png",
      route: "/image/resize",
      sourcePath: "C:\\Photos\\photo.png",
    });
  });
});
