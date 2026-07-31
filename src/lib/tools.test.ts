import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS, toolsForPaths } from "./tools";

function rustShellTools(): Array<{ id: string; acceptsMultiple: boolean }> {
  const source = readFileSync("src-tauri/src/shell/tools.rs", "utf8");
  return [
    ...source.matchAll(
      /ToolSpec\s*\{[\s\S]*?id:\s*"([^"]+)"[\s\S]*?accepts_multiple:\s*(true|false),[\s\S]*?\}/g,
    ),
  ].map((match) => ({ id: match[1], acceptsMultiple: match[2] === "true" }));
}

describe("tool catalog parity", () => {
  it("keeps frontend and Rust shell tool ids in sync", () => {
    const frontendIds = TOOLS.map((tool) => tool.id).sort();
    const shellIds = rustShellTools().map((tool) => tool.id).sort();

    expect(shellIds).toEqual(frontendIds);
  });

  it("keeps multi-file capability in sync with the Rust shell catalog", () => {
    const shellTools = new Map(
      rustShellTools().map((tool) => [tool.id, tool.acceptsMultiple]),
    );
    expect(
      TOOLS.every((tool) => shellTools.get(tool.id) === tool.acceptsMultiple),
    ).toBe(true);
  });

  it("only offers tools compatible with every selected file", () => {
    const multiImageTools = toolsForPaths(["first.jpg", "second.png"]);
    expect(multiImageTools.map((tool) => tool.id)).toContain("image-resize");
    expect(multiImageTools.map((tool) => tool.id)).not.toContain("image-crop");
    expect(toolsForPaths(["first.jpg"]).map((tool) => tool.id)).toContain("image-crop");
    expect(toolsForPaths(["first.jpg", "second.pdf"])).toEqual([]);
  });
});
