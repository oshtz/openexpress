import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore, type AppJob } from "../../stores/appStore";
import { JobTray } from "./JobTray";

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
});
