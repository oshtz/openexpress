import { spawnSync } from "node:child_process";

const allowedAdvisories = new Map([
  [
    "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
    "React Server Components only; OpenExpress uses client-side BrowserRouter",
  ],
]);

if (!process.env.npm_execpath) {
  throw new Error("Run this check through `npm run audit:prod`.");
}
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "audit", "--omit=dev", "--json"],
  {
    encoding: "utf8",
  },
);
if (result.error) throw result.error;

const report = JSON.parse(result.stdout);
if (!report.auditReportVersion) {
  console.error(report.message ?? result.stderr ?? "npm audit did not return a report.");
  process.exit(1);
}
const advisories = Object.values(report.vulnerabilities ?? {})
  .flatMap((vulnerability) => vulnerability.via ?? [])
  .filter((entry) => typeof entry === "object" && entry !== null && entry.url);
const unexpected = advisories.filter((advisory) => !allowedAdvisories.has(advisory.url));

if (unexpected.length > 0) {
  for (const advisory of unexpected) {
    console.error(`${advisory.severity}: ${advisory.title} (${advisory.url})`);
  }
  process.exit(1);
}

const total = report.metadata?.vulnerabilities?.total ?? 0;
if (total > 0 && advisories.length === 0) {
  console.error(`npm reported ${total} production vulnerabilities without advisory details.`);
  process.exit(1);
}

for (const advisory of advisories) {
  console.log(`Allowed ${advisory.url}: ${allowedAdvisories.get(advisory.url)}`);
}
console.log("No applicable production npm advisories.");
