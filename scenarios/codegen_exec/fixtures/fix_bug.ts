import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDir = process.argv[2];
if (!projectDir) {
  throw new Error("project directory is required");
}

const target = path.join(projectDir, "math_ops.ts");
const source = await readFile(target, "utf8");
await writeFile(target, source.replace("return a - b", "return a + b"), "utf8");

console.log(JSON.stringify({ patched_files: ["math_ops.ts"], workspace_dir: projectDir }));
