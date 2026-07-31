import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function Harness() {
  useKeyboardShortcuts();
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe("useKeyboardShortcuts", () => {
  it("opens settings and the queue from the status-bar function keys", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    await user.keyboard("{F2}");
    expect(screen.getByTestId("location")).toHaveTextContent("/settings");

    await user.keyboard("{F3}");
    expect(screen.getByTestId("location")).toHaveTextContent("/?view=queue");
  });
});
