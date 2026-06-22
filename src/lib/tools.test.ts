import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./tools";

function rustShellToolIds(): string[] {
  const source = readFileSync("src-tauri/src/shell/tools.rs", "utf8");
  return [...source.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
}

describe("tool catalog parity", () => {
  it("keeps frontend and Rust shell tool ids in sync", () => {
    const frontendIds = TOOLS.map((tool) => tool.id).sort();
    const shellIds = rustShellToolIds().sort();

    expect(shellIds).toEqual(frontendIds);
  });
});
