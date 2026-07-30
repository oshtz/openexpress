import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Home } from "./Home";

describe("Home", () => {
  it("filters the tool catalog from the first-viewport search", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("searchbox", { name: "Find a tool" }), "not-a-tool");
    expect(screen.getByText("No matching tools.")).toBeVisible();
  });
});
