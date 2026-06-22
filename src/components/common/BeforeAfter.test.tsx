import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BeforeAfter } from "./BeforeAfter";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

describe("BeforeAfter", () => {
  it("places the after image on the right side under an opaque transparency backdrop", () => {
    render(
      <BeforeAfter
        beforePath="C:/media/before.png"
        afterPath="C:/media/after.png"
        cacheBuster="123"
      />,
    );

    expect(screen.getByAltText("Before")).toHaveAttribute("src", "asset://C:/media/before.png");
    expect(screen.getByAltText("After")).toHaveAttribute("src", "asset://C:/media/after.png?v=123");

    const afterPane = screen.getByAltText("After").parentElement;
    expect(afterPane).toHaveStyle({ clipPath: "inset(0 0 0 50%)" });
    expect(afterPane?.style.backgroundImage).toContain("linear-gradient");
    expect(afterPane?.style.backgroundColor).toBe("var(--color-checker-bg)");
  });
});
