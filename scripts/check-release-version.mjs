import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoToml.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock root": packageLock.packages?.[""]?.version,
  "Cargo.toml": cargoVersion,
  "tauri.conf.json": tauriConfig.version,
};
const unique = new Set(Object.values(versions));
if (unique.size !== 1 || unique.has(undefined)) {
  throw new Error(`Release versions do not match:\n${JSON.stringify(versions, null, 2)}`);
}

const version = packageJson.version;
const tag =
  process.env.RELEASE_TAG ??
  (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
if (tag && tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match v${version}.`);
}

console.log(`Release version ${version} is aligned.`);
