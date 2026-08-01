import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { mockSetZoom } from "../test/setup";
import { Settings } from "./Settings";

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: unknown;
  },
  invoke: vi.fn(async (command: string) => {
    if (command === "shell_integration_status") {
      return { installed: false, needs_repair: false, manual_only: false, note: null };
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

  it("persists the selected accent color", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "Add to right-click menu" });
    await screen.findAllByText("Update checks are disabled in this build.");
    fireEvent.change(screen.getByLabelText("Accent color"), {
      target: { value: "#ff4f91" },
    });

    expect(localStorage.getItem("accentColor")).toBe("#ff4f91");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("#ff4f91");
  });

  it("persists and applies the selected UI scale", async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("UI scale"), { target: { value: "120" } });

    expect(localStorage.getItem("uiScale")).toBe("120");
    await waitFor(() => expect(mockSetZoom).toHaveBeenCalledWith(1.2));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(localStorage.getItem("uiScale")).toBe("100");
  });
});
