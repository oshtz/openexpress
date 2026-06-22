import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDialogOpen } from "../../test/setup";
import { ImageRemoveBg } from "./ImageRemoveBg";
import { ImageUpscale } from "./ImageUpscale";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: unknown;
  },
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: invokeMock,
}));

function renderTool(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("AI model tool pages", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockRejectedValue({
      kind: "FeatureDisabled",
      message: "ML features are disabled in this build.",
    });
  });

  it("does not label the disabled Remove Background inference action as a download button", async () => {
    renderTool(<ImageRemoveBg />);

    expect(await screen.findByText("ML features are disabled in this build.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Model required" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Download model to enable" }),
    ).not.toBeInTheDocument();
  });

  it("does not label the disabled AI Upscale inference action as a download button", async () => {
    renderTool(<ImageUpscale />);

    expect(await screen.findByText("ML features are disabled in this build.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Model required" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Download model to enable" }),
    ).not.toBeInTheDocument();
  });

  it("explains AI Upscale auto-fit when the selected image exceeds the non-tiled size cap", async () => {
    const user = userEvent.setup();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "model_info") {
        return {
          id: "realesrgan_x4plus",
          filename: "real_esrgan_x4plus.onnx",
          approx_bytes: 62_153_912,
          description: "Real-ESRGAN x4plus upscaler (BSD-3).",
          installed: true,
          path: "C:/Users/USER/AppData/Roaming/openexpress/models/real_esrgan_x4plus.onnx",
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    mockDialogOpen.mockResolvedValueOnce("C:/media/tall.png");

    renderTool(<ImageUpscale />);

    await user.click(screen.getByRole("button", { name: /drop an image here/i }));
    const preview = await screen.findByAltText("Preview");
    Object.defineProperties(preview, {
      naturalWidth: { configurable: true, value: 800 },
      naturalHeight: { configurable: true, value: 1311 },
    });
    fireEvent.load(preview);

    expect(screen.getByText("Input is 800 x 1311. It will be fitted to 625 x 1024 before 4x upscale.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upscale 4x" })).toBeEnabled();
  });
});
