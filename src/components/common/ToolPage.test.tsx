import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Settings } from "lucide-react";
import { ToolPage } from "./ToolPage";
import { ErrorPanel } from "./ErrorPanel";
import { ProgressBar } from "./ProgressBar";
import { ResultPanel } from "./ResultPanel";

function renderToolPage(ui: React.ReactElement, path = "/image/compress") {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe("ToolPage", () => {
  it("renders the unified input/settings workspace and below-workspace status panels", () => {
    renderToolPage(
      <ToolPage
        title="Compress Image"
        description="Reduce image file size locally."
        icon={<Settings />}
        upload={<div>Upload target</div>}
        controls={<button disabled>Compress</button>}
      >
        <ProgressBar percent={42} label="Compressing" />
        <ErrorPanel error={{ kind: "Internal", message: "Could not compress" }} />
        <ResultPanel outputPath="C:/tmp/output.jpg" stats={[{ label: "Saved", value: "1.2 MB" }]} />
      </ToolPage>,
    );

    expect(screen.getByRole("heading", { name: "Compress Image" })).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Upload target")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compress" })).toBeDisabled();
    expect(screen.getByText("Compressing")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Could not compress")).toBeInTheDocument();
    expect(screen.getByText("C:/tmp/output.jpg")).toBeInTheDocument();
  });

  it("shows a clear affordance when preview content replaces the upload area", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    renderToolPage(
      <ToolPage
        title="Preview Tool"
        description="Preview then clear."
        icon={<Settings />}
        upload={<div>Upload target</div>}
        preview={<div>Selected preview</div>}
        controls={<button>Run</button>}
        onClear={onClear}
      >
        <div />
      </ToolPage>,
    );

    expect(screen.queryByText("Upload target")).not.toBeInTheDocument();
    expect(screen.getByText("Selected preview")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
