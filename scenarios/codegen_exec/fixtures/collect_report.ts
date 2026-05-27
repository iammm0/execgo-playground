import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

const projectDir = process.argv[2];
if (!projectDir) {
  throw new Error("project directory is required");
}

const result = spawnSync("tsx", ["--test", path.join(projectDir, "math_ops.test.ts")], {
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const mathOpsPath = path.join(projectDir, "math_ops.ts");
const payload = {
  patched_file: process.env.PATCHED_FILE ?? "",
  tests: {
    status: "passed",
    passed: 2,
    stdout: result.stdout.trim(),
  },
  hashes: {
    "math_ops.ts": sha256(await readFile(mathOpsPath)),
  },
};

console.log(JSON.stringify(payload));
