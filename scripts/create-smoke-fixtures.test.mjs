import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVideoFixtureArgs,
  createStaticSmokeFixtures,
} from "./create-smoke-fixtures.mjs";

describe("create-smoke-fixtures", () => {
  it("creates tiny deterministic static fixtures for packaged smoke passes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openexpress-smoke-fixtures-test-"));
    try {
      const files = await createStaticSmokeFixtures(dir);

      expect(files.map((file) => file.relativePath).sort()).toEqual([
        "audio/sample-tone.wav",
        "image/sample-grid.png",
        "pdf/sample-a.pdf",
        "pdf/sample-b.pdf",
      ]);
      for (const file of files) {
        const path = join(dir, file.relativePath);
        expect(existsSync(path)).toBe(true);
        expect(statSync(path).size).toBeGreaterThan(0);
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("builds a deterministic ffmpeg command for the optional video fixture", () => {
    const args = buildVideoFixtureArgs("C:/tmp/smoke/video/sample-video.mp4");

    expect(args).toEqual([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=160x90:rate=10:duration=1",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "C:/tmp/smoke/video/sample-video.mp4",
    ]);
  });
});
