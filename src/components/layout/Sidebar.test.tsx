import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("reveals and marks the active tool after in-app navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Sidebar />
        <Link to="/pdf/compress">Open PDF Compress</Link>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Compress" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Open PDF Compress" }));

    expect(screen.getByRole("link", { name: "Compress" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
