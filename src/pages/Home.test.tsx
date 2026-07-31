import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockDialogOpen } from "../test/setup";
import { Home } from "./Home";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("Home", () => {
  it("disambiguates search results and supports keyboard launch", async () => {
    const user = userEvent.setup();
    renderHome();

    const search = screen.getByRole("combobox", { name: "Find a tool" });
    await user.type(search, "compress");

    expect(screen.getByRole("option", { name: /Compress Image/i })).toBeVisible();
    expect(screen.getByRole("option", { name: /Compress PDF/i })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 matching tools");
    expect(screen.queryByText("All tools")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("location")).toHaveTextContent("/image/compress");
  });

  it("routes a selected file through the compatible-tool picker", async () => {
    const user = userEvent.setup();
    mockDialogOpen.mockResolvedValueOnce("C:/media/photo.png");
    renderHome();

    await user.click(
      screen.getByRole("button", { name: "Drop a file to see compatible tools" }),
    );

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/pick?file=C%3A%2Fmedia%2Fphoto.png",
    );
  });
});
