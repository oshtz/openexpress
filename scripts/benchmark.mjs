#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const distDir = join(root, "dist");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

function summarizeFiles(dir, { gzip = false } = {}) {
  return walk(dir)
    .map((path) => {
      const raw = statSync(path).size;
      const item = { path: relative(root, path), bytes: raw, display: bytes(raw) };
      if (gzip) {
        const compressed = gzipSync(readFileSync(path)).length;
        item.gzipBytes = compressed;
        item.gzipDisplay = bytes(compressed);
      }
      return item;
    })
    .sort((a, b) => b.bytes - a.bytes);
}

const report = {
  generatedAt: new Date().toISOString(),
  distExists: existsSync(distDir),
  bundleExists: existsSync(bundleDir),
  distFiles: summarizeFiles(distDir, { gzip: true }),
  bundleFiles: summarizeFiles(bundleDir),
  manualBenchmarks: [
    "Packaged app cold startup time from process launch to usable home screen",
    "4K image resize wall time and output size",
    "ffmpeg progress update responsiveness on a representative video trim/convert",
    "idle RAM after 60 seconds on home screen",
    "large batch behavior: 50 images and mixed failure handling",
  ],
};

writeFileSync(join(root, "benchmark-report.json"), JSON.stringify(report, null, 2));
console.log(`Wrote benchmark-report.json`);
console.log(`dist files: ${report.distFiles.length}`);
console.log(`bundle files: ${report.bundleFiles.length}`);
if (!report.distExists) console.log("dist/ missing — run npm run build before benchmark snapshots.");
if (!report.bundleExists) console.log("release bundle missing — run npm run tauri build for installer-size snapshots.");
