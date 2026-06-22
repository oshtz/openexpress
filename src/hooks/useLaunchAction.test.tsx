import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLaunchAction } from "./useLaunchAction";

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
});
