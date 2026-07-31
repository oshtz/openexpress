import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShellIntegrationPanel } from "./ShellIntegrationPanel";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

describe("ShellIntegrationPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "shell_integration_status") {
        return {
          installed: true,
          needs_repair: true,
          manual_only: false,
          note: null,
        };
      }
      if (command === "register_shell_integration") return undefined;
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it("repairs stale integration instead of removing it", async () => {
    render(<ShellIntegrationPanel />);

    expect(await screen.findByText("Needs repair")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Repair right-click menu" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("register_shell_integration"),
    );
    expect(invokeMock).not.toHaveBeenCalledWith("unregister_shell_integration");
  });
});
