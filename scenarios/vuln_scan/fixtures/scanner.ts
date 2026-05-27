import { readFile } from "node:fs/promises";

type Dependency = { name: string; version: string };
type Advisory = { package: string; affected_below: string; id: string; severity: string };

function versionTuple(value: string): number[] {
  return value.split(".").map((part) => Number(part));
}

function versionLessThan(left: string, right: string): boolean {
  const a = versionTuple(left);
  const b = versionTuple(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff < 0;
    }
  }
  return false;
}

const manifestPath = process.argv[2];
const advisoryUrl = process.argv[3];
if (!manifestPath || !advisoryUrl) {
  throw new Error("manifest path and advisory url are required");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { dependencies: Dependency[] };
const advisoryPayload = (await (await fetch(advisoryUrl)).json()) as { advisories: Advisory[] };

const findings = [];
for (const dep of manifest.dependencies) {
  for (const advisory of advisoryPayload.advisories) {
    if (dep.name !== advisory.package) {
      continue;
    }
    if (versionLessThan(dep.version, advisory.affected_below)) {
      findings.push({
        id: advisory.id,
        package: dep.name,
        version: dep.version,
        severity: advisory.severity,
      });
    }
  }
}

console.log(
  JSON.stringify({
    findings,
    summary: {
      total: findings.length,
      high: findings.filter((item) => item.severity === "high").length,
      medium: findings.filter((item) => item.severity === "medium").length,
    },
  }),
);
