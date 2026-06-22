import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelDownloadCard } from "./ModelDownloadCard";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: unknown;
  },
  invoke: invokeMock,
}));

describe("ModelDownloadCard", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("shows an enabled download button when a model is missing but downloadable", async () => {
    invokeMock.mockResolvedValueOnce({
      id: "realesrgan_x4plus",
      filename: "real_esrgan_x4plus.onnx",
      approx_bytes: 62_153_912,
      description: "Real-ESRGAN x4plus upscaler (BSD-3).",
      installed: false,
      path: "C:/Users/USER/AppData/Roaming/openexpress/models/real_esrgan_x4plus.onnx",
    });

    render(<ModelDownloadCard modelId="realesrgan_x4plus" />);

    expect(await screen.findByText("First-run download required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download model/i })).toBeEnabled();
  });

  it("shows model-info failures instead of hiding the first-run gate", async () => {
    invokeMock.mockRejectedValueOnce({
      kind: "FeatureDisabled",
      message: "ML features are disabled in this build.",
    });

    render(<ModelDownloadCard modelId="realesrgan_x4plus" />);

    expect(await screen.findByText("ML features are disabled in this build.")).toBeInTheDocument();
    expect(screen.getByText("Rebuild with the relevant cargo feature flag to enable.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download model/i })).not.toBeInTheDocument();
  });
});
