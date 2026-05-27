import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = process.argv[2];
const marker = process.argv[3];
if (!workspace || !marker) {
  throw new Error("workspace and marker are required");
}

await mkdir(workspace, { recursive: true });
await writeFile(path.join(workspace, `${marker}.txt`), marker, "utf8");
console.log(JSON.stringify({ marker }));
