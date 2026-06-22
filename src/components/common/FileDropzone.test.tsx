import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileDropzone } from "./FileDropzone";
import { mockDialogOpen, mockDragDropCallbacks } from "../../test/setup";

describe("FileDropzone", () => {
  it("opens the Tauri file dialog on click and forwards selected paths", async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup();
    mockDialogOpen.mockResolvedValueOnce("C:/media/photo.png");

    render(<FileDropzone accept={["png", "jpg"]} onFiles={onFiles} />);
    await user.click(screen.getByRole("button", { name: /drop files/i }));

    expect(mockDialogOpen).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: "Accepted files", extensions: ["png", "jpg"] }],
    });
    expect(onFiles).toHaveBeenCalledWith(["C:/media/photo.png"]);
  });

  it("supports keyboard activation with Enter and Ctrl+O", async () => {
    const onFiles = vi.fn();
    const user = userEvent.setup();
    mockDialogOpen
      .mockResolvedValueOnce(["C:/media/a.png", "C:/media/b.png"])
      .mockResolvedValueOnce("C:/media/c.png");

    render(<FileDropzone accept={["png"]} multiple onFiles={onFiles} />);
    const dropzone = screen.getByRole("button", { name: /drop files/i });

    dropzone.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Control>}o{/Control}");

    expect(onFiles).toHaveBeenNthCalledWith(1, ["C:/media/a.png", "C:/media/b.png"]);
    expect(onFiles).toHaveBeenNthCalledWith(2, ["C:/media/c.png"]);
  });

  it("filters drag/drop files by extension and respects single-file mode", async () => {
    const onFiles = vi.fn();

    render(<FileDropzone accept={["png"]} onFiles={onFiles} />);
    const dropzone = screen.getByRole("button", { name: /drop files/i });
    vi.spyOn(dropzone, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
      toJSON: () => ({}),
    });

    await waitFor(() => expect(mockDragDropCallbacks.length).toBe(1));
    mockDragDropCallbacks[0]({
      payload: {
        type: "drop",
        position: { x: 10, y: 10 },
        paths: ["C:/media/a.txt", "C:/media/b.png", "C:/media/c.png"],
      },
    });

    expect(onFiles).toHaveBeenCalledWith(["C:/media/b.png"]);
  });
});
