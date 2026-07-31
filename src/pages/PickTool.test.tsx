import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PickTool } from "./PickTool";

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

describe("PickTool", () => {
  it("keeps a compatible multi-file selection when opening a tool", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/pick?file=C%3A%5Cfirst.jpg&file=C%3A%5Csecond.png",
        ]}
      >
        <Routes>
          <Route path="/pick" element={<PickTool />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("2 files selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crop/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Resize/ }));
    expect(screen.getByText(/\/image\/resize\?file=/)).toHaveTextContent(
      "/image/resize?file=C%3A%5Cfirst.jpg&file=C%3A%5Csecond.png",
    );
  });
});
