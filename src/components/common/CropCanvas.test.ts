import { describe, expect, it } from "vitest";
import { cropFromArrowKey } from "./CropCanvas";

describe("crop keyboard controls", () => {
  it("moves with arrows and resizes with Shift while staying in bounds", () => {
    const crop = { x: 10, y: 10, width: 40, height: 20 };
    const bounds = { w: 100, h: 80 };

    expect(cropFromArrowKey(crop, "ArrowRight", false, null, bounds)).toEqual({
      ...crop,
      x: 11,
    });
    expect(cropFromArrowKey(crop, "ArrowDown", true, 2, bounds)).toEqual({
      ...crop,
      width: 42,
      height: 21,
    });
  });
});
