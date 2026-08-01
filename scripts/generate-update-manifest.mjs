import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function asset(path, url, bundleIdentifier = null) {
  const info = {
    url,
    sha256: sha256(path),
    size: statSync(path).size,
  };
  if (bundleIdentifier) info.bundle_identifier = bundleIdentifier;
  return info;
}

const assetDir = process.env.UPDATE_ASSET_DIR ?? "release-assets";
const outputPath = process.env.UPDATE_MANIFEST_PATH ?? join(assetDir, "latest.json");
const repo = process.env.GITHUB_REPOSITORY ?? "oshtz/openexpress";
const tag = process.env.UPDATE_TAG ?? process.env.GITHUB_REF_NAME;
if (!tag) throw new Error("UPDATE_TAG or GITHUB_REF_NAME is required");

const version = process.env.UPDATE_VERSION ?? tag.replace(/^v/i, "");
const baseUrl = process.env.UPDATE_BASE_URL ?? `https://github.com/${repo}/releases/download/${tag}`;
const windowsAsset = join(assetDir, "OpenExpress-Portable.exe");
const macosAsset = join(assetDir, "OpenExpress.app.zip");

for (const path of [macosAsset, windowsAsset]) {
  if (!existsSync(path)) throw new Error(`Missing release asset: ${path}`);
}

const platforms = {
  [process.env.MACOS_UPDATE_PLATFORM ?? "darwin-aarch64"]: asset(
    macosAsset,
    `${baseUrl}/${basename(macosAsset)}`,
    "com.openexpress.desktop",
  ),
  "windows-x86_64": asset(
    windowsAsset,
    `${baseUrl}/${basename(windowsAsset)}`,
  ),
};

const manifest = {
  version,
  pub_date: process.env.UPDATE_PUB_DATE ?? new Date().toISOString(),
  notes: process.env.UPDATE_NOTES ?? "Initial OpenExpress release.",
  platforms,
};

mkdirSync(assetDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
console.log("Downloaded assets are SHA-256 verified before install.");
