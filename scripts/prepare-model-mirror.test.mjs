import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMirrorEntries,
  listZipEntries,
  parseModelCatalog,
  verifyArchiveMembers,
  verifyDownloadedArtifact,
} from "./prepare-model-mirror.mjs";

const CATALOG_FIXTURE = String.raw`
pub struct ModelSpec {
    pub id: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub sha256: Option<&'static str>,
    pub approx_bytes: u64,
    pub description: &'static str,
    pub archive: Option<ArchiveSpec>,
}

pub const MODELS: &[ModelSpec] = &[
    ModelSpec {
        id: "standalone",
        filename: "standalone.onnx",
        url: "https://example.com/models/standalone.onnx",
        sha256: Some("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
        approx_bytes: 4_200,
        description: "Standalone fixture model.",
        archive: None,
    },
    ModelSpec {
        id: "archive_model",
        filename: "archive.onnx",
        url: "https://example.com/models/archive-model.zip",
        sha256: Some("486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7"),
        approx_bytes: 62_153_912,
        description: "Archive fixture model.",
        archive: Some(ArchiveSpec {
            members: &[
                ArchiveMember {
                    archive_path: "archive/archive.onnx",
                    output_filename: "archive.onnx",
                },
                ArchiveMember {
                    archive_path: "archive/archive.data",
                    output_filename: "archive.data",
                },
            ],
        }),
    },
];
`;

function zipWithEntries(entryNames) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entryName of entryNames) {
    const name = Buffer.from(entryName, "utf8");
    const localHeader = Buffer.alloc(30 + name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(0, 18);
    localHeader.writeUInt32LE(0, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    name.copy(localHeader, 30);
    localHeaders.push(localHeader);

    const centralHeader = Buffer.alloc(46 + name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(0, 20);
    centralHeader.writeUInt32LE(0, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    name.copy(centralHeader, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirectory = Buffer.concat(centralHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entryNames.length, 8);
  endOfCentralDirectory.writeUInt16LE(entryNames.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDirectory, endOfCentralDirectory]);
}

describe("prepare-model-mirror", () => {
  it("parses the Rust model catalog into mirrorable model records", () => {
    const models = parseModelCatalog(CATALOG_FIXTURE);

    expect(models).toEqual([
      expect.objectContaining({
        id: "standalone",
        filename: "standalone.onnx",
        url: "https://example.com/models/standalone.onnx",
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        approxBytes: 4200,
        archiveMembers: [],
      }),
      expect.objectContaining({
        id: "archive_model",
        filename: "archive.onnx",
        url: "https://example.com/models/archive-model.zip",
        sha256: "486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7",
        approxBytes: 62153912,
        archiveMembers: [
          {
            archivePath: "archive/archive.onnx",
            outputFilename: "archive.onnx",
          },
          {
            archivePath: "archive/archive.data",
            outputFilename: "archive.data",
          },
        ],
      }),
    ]);
  });

  it("builds upload-ready entries with stable asset names and mirror URLs", () => {
    const entries = buildMirrorEntries(parseModelCatalog(CATALOG_FIXTURE), {
      mirrorBaseUrl: "https://github.com/oshtz/openexpress/releases/download/models-v1",
    });

    expect(entries).toEqual([
      expect.objectContaining({
        id: "standalone",
        assetName: "standalone-standalone.onnx",
        mirrorUrl:
          "https://github.com/oshtz/openexpress/releases/download/models-v1/standalone-standalone.onnx",
      }),
      expect.objectContaining({
        id: "archive_model",
        assetName: "archive_model-archive-model.zip",
        mirrorUrl:
          "https://github.com/oshtz/openexpress/releases/download/models-v1/archive_model-archive-model.zip",
      }),
    ]);
  });

  it("refuses to prepare public mirror entries for unpinned models", () => {
    expect(() =>
      buildMirrorEntries([
        {
          id: "unpinned",
          filename: "unpinned.onnx",
          url: "https://example.com/unpinned.onnx",
          sha256: null,
          approxBytes: 1,
          description: "Missing checksum",
          archiveMembers: [],
        },
      ]),
    ).toThrow("Model 'unpinned' does not declare a SHA-256 checksum");
  });

  it("verifies downloaded artifact checksums", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openexpress-model-mirror-test-"));
    try {
      const path = join(dir, "hello.bin");
      writeFileSync(path, "hello");

      await expect(
        verifyDownloadedArtifact(path, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
      ).resolves.toEqual({
        path,
        sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        size: 5,
      });

      await expect(verifyDownloadedArtifact(path, "0".repeat(64))).rejects.toThrow(
        "checksum mismatch",
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("lists entries from a zip central directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openexpress-model-mirror-test-"));
    try {
      const path = join(dir, "fixture.zip");
      writeFileSync(path, zipWithEntries(["model/model.onnx", "model/model.data"]));

      await expect(listZipEntries(path)).resolves.toEqual(["model/model.onnx", "model/model.data"]);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("verifies expected archive model members exist in downloaded zips", async () => {
    const dir = mkdtempSync(join(tmpdir(), "openexpress-model-mirror-test-"));
    try {
      const path = join(dir, "fixture.zip");
      writeFileSync(path, zipWithEntries(["RealESRGAN_x4plus.onnx"]));

      await expect(
        verifyArchiveMembers(path, [
          {
            archivePath: "RealESRGAN_x4plus.onnx",
            outputFilename: "realesrgan_x4plus.onnx",
          },
        ]),
      ).resolves.toEqual(["RealESRGAN_x4plus.onnx"]);

      await expect(
        verifyArchiveMembers(path, [
          {
            archivePath: "missing-model.onnx",
            outputFilename: "missing-model.onnx",
          },
        ]),
      ).rejects.toThrow("missing archive member");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
