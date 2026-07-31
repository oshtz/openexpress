import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { targetForLaunch, useLaunchAction } from "./useLaunchAction";

function HookProbe() {
  useLaunchAction();
  return null;
}

describe("useLaunchAction", () => {
  const originalTauriInternals = window.__TAURI_INTERNALS__;

  afterEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: originalTauriInternals,
    });
  });

  it("does not subscribe when rendered outside the Tauri runtime", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const unhandled = vi.fn((event: PromiseRejectionEvent) => event.preventDefault());
    window.addEventListener("unhandledrejection", unhandled);

    render(
      <MemoryRouter>
        <HookProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(unhandled).not.toHaveBeenCalled());
    window.removeEventListener("unhandledrejection", unhandled);
  });

  it("preserves every selected file in the target URL", () => {
    expect(
      targetForLaunch({
        tool: null,
        route: "/pick",
        files: ["C:\\first image.jpg", "C:\\second.png"],
      }),
    ).toBe("/pick?file=C%3A%5Cfirst+image.jpg&file=C%3A%5Csecond.png");
  });
});
