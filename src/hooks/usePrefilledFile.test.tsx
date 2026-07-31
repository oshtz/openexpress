import { useCallback } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { usePrefilledFile } from "./usePrefilledFile";

vi.mock("../lib/assets", () => ({
  allowAssetPaths: vi.fn().mockResolvedValue(undefined),
}));

function Harness({ onFile }: { onFile: (paths: string[]) => void }) {
  const navigate = useNavigate();
  const handleFile = useCallback((paths: string[]) => onFile(paths), [onFile]);
  usePrefilledFile(handleFile);

  return (
    <button onClick={() => navigate("?file=C%3A%5Csecond.png")}>
      Open second file
    </button>
  );
}

describe("usePrefilledFile", () => {
  it("delivers complete repeated handoffs without remounting the route", async () => {
    const onFile = vi.fn();
    render(
      <MemoryRouter
        initialEntries={["/tool?file=C%3A%5Cfirst.png&file=C%3A%5Csecond.png"]}
      >
        <Routes>
          <Route path="/tool" element={<Harness onFile={onFile} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(onFile).toHaveBeenCalledWith(["C:\\first.png", "C:\\second.png"]),
    );
    fireEvent.click(document.querySelector("button")!);
    await waitFor(() => expect(onFile).toHaveBeenCalledWith(["C:\\second.png"]));
    expect(onFile).toHaveBeenCalledTimes(2);
  });
});
