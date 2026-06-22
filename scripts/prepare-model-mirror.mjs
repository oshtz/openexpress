import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CATALOG_PATH = "src-tauri/src/plugins/models.rs";
const DEFAULT_MANIFEST_NAME = "model-mirror-manifest.json";
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_MIN_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ZIP_MAX_COMMENT_SIZE = 65_535;

function collectStructBlocks(source, structName) {
  const blocks = [];
  let searchFrom = 0;
  const needle = `${structName} {`;

  while (true) {
    const start = source.indexOf(needle, searchFrom);
    if (start === -1) break;

    const braceStart = source.indexOf("{", start);
    let depth = 0;
    let end = braceStart;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    if (depth !== 0) {
      throw new Error(`Unbalanced ${structName} block in model catalog`);
    }

    blocks.push(source.slice(start, end));
    searchFrom = end;
  }

  return blocks;
}

function stringField(block, field) {
  const match = block.match(new RegExp(`${field}:\\s*"([^"]+)"`));
  if (!match) throw new Error(`Missing string field '${field}' in model catalog block`);
  return match[1];
}

function optionalSha256(block) {
  const some = block.match(/sha256:\s*Some\("([a-fA-F0-9]{64})"\)/);
  if (some) return some[1].toLowerCase();
  if (/sha256:\s*None/.test(block)) return null;
  throw new Error("Missing sha256 field in model catalog block");
}

function numberField(block, field) {
  const match = block.match(new RegExp(`${field}:\\s*([0-9_]+)`));
  if (!match) throw new Error(`Missing numeric field '${field}' in model catalog block`);
  return Number.parseInt(match[1].replaceAll("_", ""), 10);
}

function archiveMembers(block) {
  return collectStructBlocks(block, "ArchiveMember").map((member) => ({
    archivePath: stringField(member, "archive_path"),
    outputFilename: stringField(member, "output_filename"),
  }));
}

export function parseModelCatalog(source) {
  const modelsStart = source.indexOf("pub const MODELS");
  if (modelsStart === -1) {
    throw new Error("Could not find pub const MODELS in model catalog");
  }
  const modelsSource = source.slice(modelsStart);

  return collectStructBlocks(modelsSource, "ModelSpec").map((block) => ({
    id: stringField(block, "id"),
    filename: stringField(block, "filename"),
    url: stringField(block, "url"),
    sha256: optionalSha256(block),
    approxBytes: numberField(block, "approx_bytes"),
    description: stringField(block, "description"),
    archiveMembers: archiveMembers(block),
  }));
}

function sourceBasename(url) {
  try {
    return basename(decodeURIComponent(new URL(url).pathname));
  } catch (error) {
    throw new Error(`Invalid model URL '${url}': ${error.message}`);
  }
}

function safeAssetName(model) {
  const sourceName = sourceBasename(model.url);
  const raw = `${model.id}-${sourceName}`;
  return raw.replace(/[^A-Za-z0-9._-]+/g, "-");
}

function mirrorUrl(baseUrl, assetName) {
  return `${baseUrl.replace(/\/+$/, "")}/${assetName}`;
}

export function buildMirrorEntries(models, options = {}) {
  const { mirrorBaseUrl = null } = options;

  return models.map((model) => {
    if (!model.sha256) {
      throw new Error(`Model '${model.id}' does not declare a SHA-256 checksum`);
    }

    const assetName = safeAssetName(model);
    return {
      id: model.id,
      filename: model.filename,
      description: model.description,
      sourceUrl: model.url,
      sourceAssetName: sourceBasename(model.url),
      assetName,
      mirrorUrl: mirrorBaseUrl ? mirrorUrl(mirrorBaseUrl, assetName) : null,
      sha256: model.sha256,
      approxBytes: model.approxBytes,
      archiveMembers: model.archiveMembers,
    };
  });
}

export async function verifyDownloadedArtifact(path, expectedSha256) {
  const hasher = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hasher.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });

  const actual = hasher.digest("hex");
  if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(`checksum mismatch for ${path}: expected ${expectedSha256}, got ${actual}`);
  }

  const info = await stat(path);
  return { path, sha256: actual, size: info.size };
}

function findZipEndOfCentralDirectory(buffer, path) {
  const searchStart = Math.max(
    0,
    buffer.length - ZIP_MIN_END_OF_CENTRAL_DIRECTORY_SIZE - ZIP_MAX_COMMENT_SIZE,
  );

  for (let offset = buffer.length - ZIP_MIN_END_OF_CENTRAL_DIRECTORY_SIZE; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error(`${path} is not a valid zip archive: missing end of central directory`);
}

export async function listZipEntries(path) {
  const buffer = await readFile(path);
  const endOffset = findZipEndOfCentralDirectory(buffer, path);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  if (centralDirectoryOffset < 0 || centralDirectoryEnd > buffer.length) {
    throw new Error(`${path} is not a valid zip archive: central directory is out of bounds`);
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > centralDirectoryEnd) {
      throw new Error(`${path} is not a valid zip archive: truncated central directory`);
    }
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`${path} is not a valid zip archive: invalid central directory entry`);
    }

    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const filenameStart = offset + 46;
    const filenameEnd = filenameStart + filenameLength;
    const nextOffset = filenameEnd + extraLength + commentLength;
    if (filenameEnd > centralDirectoryEnd || nextOffset > centralDirectoryEnd) {
      throw new Error(`${path} is not a valid zip archive: truncated central directory filename`);
    }

    entries.push(buffer.toString("utf8", filenameStart, filenameEnd).replaceAll("\\", "/"));
    offset = nextOffset;
  }

  return entries;
}

export async function verifyArchiveMembers(path, members) {
  if (!members.length) return [];

  const zipEntries = new Set(await listZipEntries(path));
  const expectedMembers = members.map((member) => member.archivePath);
  const missing = expectedMembers.filter((archivePath) => !zipEntries.has(archivePath));
  if (missing.length) {
    throw new Error(`${path} is missing archive member(s): ${missing.join(", ")}`);
  }

  return expectedMembers;
}

async function downloadEntry(entry, downloadDir, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) {
    throw new Error("Global fetch is unavailable; run with Node 20 or newer.");
  }

  const destination = join(downloadDir, entry.assetName);
  const response = await fetchImpl(entry.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${entry.id}: HTTP ${response.status} from ${entry.sourceUrl}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  const verified = await verifyDownloadedArtifact(destination, entry.sha256);
  const verifiedArchiveMembers = await verifyArchiveMembers(destination, entry.archiveMembers);
  return { ...entry, localPath: destination, size: verified.size, verifiedArchiveMembers };
}

function renderPlan(entries) {
  const lines = [
    "OpenExpress model mirror plan",
    "",
    "| Model | Upload asset | SHA-256 | Source |",
    "| --- | --- | --- | --- |",
  ];

  for (const entry of entries) {
    lines.push(`| ${entry.id} | ${entry.assetName} | ${entry.sha256} | ${entry.sourceUrl} |`);
  }

  lines.push("");
  lines.push("Run with --download-dir <path> to download and verify these artifacts.");
  lines.push("After upload, pass --mirror-base-url <release-asset-base-url> to print the mirrored URLs.");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = {
    catalogPath: DEFAULT_CATALOG_PATH,
    downloadDir: null,
    manifestPath: null,
    mirrorBaseUrl: null,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--catalog") args.catalogPath = argv[++i];
    else if (arg === "--download-dir") args.downloadDir = argv[++i];
    else if (arg === "--manifest") args.manifestPath = argv[++i];
    else if (arg === "--mirror-base-url") args.mirrorBaseUrl = argv[++i];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function helpText() {
  return `Usage: node scripts/prepare-model-mirror.mjs [options]

Options:
  --catalog <path>           Rust model catalog path. Default: ${DEFAULT_CATALOG_PATH}
  --download-dir <path>      Download and verify artifacts into this directory.
  --manifest <path>          Manifest output path. Default: <download-dir>/${DEFAULT_MANIFEST_NAME}
  --mirror-base-url <url>    Future mirrored release asset base URL.
  --json                     Print JSON instead of the markdown table.
  -h, --help                 Show this help.
`;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(helpText());
    return;
  }

  const catalogSource = await readFile(args.catalogPath, "utf8");
  const entries = buildMirrorEntries(parseModelCatalog(catalogSource), {
    mirrorBaseUrl: args.mirrorBaseUrl,
  });

  if (!args.downloadDir) {
    console.log(args.json ? JSON.stringify(entries, null, 2) : renderPlan(entries));
    return;
  }

  const downloadDir = resolve(args.downloadDir);
  await mkdir(downloadDir, { recursive: true });
  const downloaded = [];
  for (const entry of entries) {
    console.log(`Downloading ${entry.id} -> ${entry.assetName}`);
    downloaded.push(await downloadEntry(entry, downloadDir));
  }

  const manifestPath = args.manifestPath ?? join(downloadDir, DEFAULT_MANIFEST_NAME);
  const manifest = {
    generatedAt: new Date().toISOString(),
    catalogPath: args.catalogPath,
    models: downloaded,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifestPath}`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
