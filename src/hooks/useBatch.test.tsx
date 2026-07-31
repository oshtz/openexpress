import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../stores/appStore";
import { useBatch } from "./useBatch";

describe("useBatch jobs", () => {
  beforeEach(() => {
    useAppStore.setState({ jobs: [] });
    window.history.replaceState({}, "", "/image/resize");
  });

  it("keeps the first successful output available from the job tray", async () => {
    const { result } = renderHook(() =>
      useBatch<string, { output_path: string }>(),
    );

    await act(async () => {
      await result.current.start(["one.png", "two.png"], async (item) => ({
        output_path: `C:\\Exports\\${item}`,
      }));
    });

    expect(useAppStore.getState().jobs[0]).toMatchObject({
      status: "succeeded",
      outputPath: "C:\\Exports\\one.png",
      completed: 2,
    });
  });
});
