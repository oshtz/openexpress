import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore, type AppJob } from "../../stores/appStore";
import { JobTray } from "./JobTray";

const { shellOpen } = vi.hoisted(() => ({ shellOpen: vi.fn() }));

vi.mock("@tauri-apps/plugin-shell", () => ({ open: shellOpen }));

const baseJob: AppJob = {
  id: "job",
  tool: "Resize",
  route: "/image/resize",
  startedAt: 1,
  status: "running",
  total: 1,
  completed: 0,
  failed: 0,
  progress: null,
};

describe("JobTray", () => {
  beforeEach(() => {
    shellOpen.mockReset();
    useAppStore.setState({ jobs: [] });
  });

  it("summarizes the active job ahead of a newer finished job", () => {
    useAppStore.setState({
      jobs: [
        { ...baseJob, id: "finished", tool: "Convert", status: "succeeded" },
        { ...baseJob, id: "active" },
      ],
    });

    render(
      <MemoryRouter>
        <JobTray />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 active")).toBeVisible();
    expect(screen.getByText(/Resize.*Working/)).toBeVisible();
  });

  it("opens a completed job output without navigating away", async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      jobs: [
        {
          ...baseJob,
          status: "succeeded",
          outputPath: "C:\\Exports\\photo-resized.png",
        },
      ],
    });

    render(
      <MemoryRouter>
        <JobTray />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Recent jobs/ }));
    await user.click(screen.getByRole("button", { name: "Open Resize output" }));

    expect(shellOpen).toHaveBeenCalledWith("C:\\Exports\\photo-resized.png");
  });
});
