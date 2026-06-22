import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("generate-update-manifest", () => {
  it("generates an updater manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "openexpress-update-manifest-test-"));
    try {
      writeFileSync(join(dir, "OpenExpress-Portable.exe"), "windows");
      writeFileSync(join(dir, "OpenExpress.app.zip"), "macos");

      execFileSync(process.execPath, ["scripts/generate-update-manifest.mjs"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          UPDATE_ASSET_DIR: dir,
          UPDATE_TAG: "v9.9.9",
          UPDATE_VERSION: "9.9.9",
          UPDATE_PUB_DATE: "2026-06-10T00:00:00.000Z",
          UPDATE_NOTES: "Fixture release",
          MACOS_UPDATE_PLATFORM: "darwin-aarch64",
        },
      });

      const manifest = JSON.parse(readFileSync(join(dir, "latest.json"), "utf8"));
      expect(manifest).toMatchObject({
        version: "9.9.9",
        notes: "Fixture release",
        platforms: {
          "windows-x86_64": expect.objectContaining({
            url: "https://github.com/oshtz/openexpress/releases/download/v9.9.9/OpenExpress-Portable.exe",
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            size: 7,
          }),
          "darwin-aarch64": expect.objectContaining({
            url: "https://github.com/oshtz/openexpress/releases/download/v9.9.9/OpenExpress.app.zip",
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            size: 5,
            bundle_identifier: "com.openexpress.desktop",
          }),
        },
      });
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
