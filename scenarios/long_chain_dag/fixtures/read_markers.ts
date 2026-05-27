import { readdir } from "node:fs/promises";
import path from "node:path";

const workspace = process.argv[2];
if (!workspace) {
  throw new Error("workspace is required");
}

const markers = (await readdir(workspace))
  .filter((name) => name.endsWith(".txt"))
  .map((name) => path.basename(name, ".txt"))
  .sort();

console.log(JSON.stringify({ lineage: markers, summary: { status: "success" } }));
