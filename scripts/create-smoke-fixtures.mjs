import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT_DIR = "dist/manual-smoke-fixtures";
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARLJgYGBgAAAkBgICdF9xVAAAAABJRU5ErkJggg==";

function makeWavTone() {
  const sampleRate = 8000;
  const seconds = 1;
  const samples = sampleRate * seconds;
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples; i += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0x3fff);
    buffer.writeInt16LE(value, 44 + i * 2);
  }

  return buffer;
}

function makePdf(label) {
  const stream = `BT /F1 16 Tf 36 120 Td (${label}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 180] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

async function writeFixture(outputDir, relativePath, bytes, purpose) {
  const path = join(outputDir, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return { relativePath, purpose };
}

export async function createStaticSmokeFixtures(outputDir) {
  const root = resolve(outputDir);
  return [
    await writeFixture(
      root,
      "image/sample-grid.png",
      Buffer.from(SAMPLE_PNG_BASE64, "base64"),
      "Raster image input for resize/crop/convert/compress/clipboard smoke tests.",
    ),
    await writeFixture(
      root,
      "audio/sample-tone.wav",
      makeWavTone(),
      "One-second mono WAV for trim/convert/fade/volume smoke tests.",
    ),
    await writeFixture(root, "pdf/sample-a.pdf", makePdf("OpenExpress PDF A"), "PDF input A."),
    await writeFixture(root, "pdf/sample-b.pdf", makePdf("OpenExpress PDF B"), "PDF input B."),
  ];
}

export function buildVideoFixtureArgs(outputPath) {
  return [
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
    outputPath,
  ];
}

async function createVideoFixture(outputDir) {
  const outputPath = join(resolve(outputDir), "video/sample-video.mp4");
  await mkdir(dirname(outputPath), { recursive: true });
  const args = buildVideoFixtureArgs(outputPath);

  return new Promise((resolvePromise) => {
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    child.on("error", () => {
      resolvePromise({ relativePath: "video/sample-video.mp4", skipped: true });
    });
    child.on("exit", (code) => {
      resolvePromise({
        relativePath: "video/sample-video.mp4",
        skipped: code !== 0,
      });
    });
  });
}

function parseArgs(argv) {
  const args = { outputDir: DEFAULT_OUTPUT_DIR, video: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output-dir") args.outputDir = argv[++i];
    else if (arg === "--no-video") args.video = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function helpText() {
  return `Usage: node scripts/create-smoke-fixtures.mjs [options]

Options:
  --output-dir <path>  Fixture output directory. Default: ${DEFAULT_OUTPUT_DIR}
  --no-video           Skip optional ffmpeg MP4 generation.
  -h, --help           Show this help.
`;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(helpText());
    return;
  }

  const files = await createStaticSmokeFixtures(args.outputDir);
  if (args.video) {
    const video = await createVideoFixture(args.outputDir);
    files.push({
      ...video,
      purpose: video.skipped
        ? "Optional MP4 fixture skipped because ffmpeg was unavailable or failed."
        : "One-second MP4 for trim/convert/resize/GIF/audio-extract smoke tests.",
    });
  }

  console.log(`Wrote smoke fixtures to ${resolve(args.outputDir)}`);
  for (const file of files) {
    console.log(`- ${file.relativePath}${file.skipped ? " (skipped)" : ""}: ${file.purpose}`);
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
