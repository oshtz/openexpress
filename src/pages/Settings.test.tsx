import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Settings } from "./Settings";

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: unknown;
  },
  invoke: vi.fn(async (command: string) => {
    if (command === "shell_integration_status") {
      return { installed: false, manual_only: false, note: null };
    }
    if (command === "check_update") {
      return {
        currentVersion: "0.1.0",
        latestVersion: null,
        available: false,
        blocked: true,
        reason: "debugBuild",
        message: "Update checks are disabled in this build.",
        notes: null,
        pubDate: null,
        asset: null,
      };
    }
    throw new Error(`Unexpected command: ${command}`);
  }),
}));

describe("Settings", () => {
  it("renders the About copy without mojibake", async () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "OpenExpress - a free, open-source media toolkit. Built with Tauri, React, and Rust.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Shell integration")).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/[\u0590-\u05ff]|\u20ac|\u009d/);
  });
});
