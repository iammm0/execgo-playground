import path from "node:path";
import { readJson, repoRoot, writeJson } from "./utils.js";

const SCHEMA_FILES = [
  "benchmark-result.schema.json",
  "benchmark-run-request.schema.json",
  "chaos-profile.schema.json",
  "scenario.schema.json",
  "standard-plan.schema.json",
  "timeline-event.schema.json",
];

export async function exportSchemas(outputDir: string): Promise<string[]> {
  const sourceDir = path.join(repoRoot(), "shared", "spec");
  const written: string[] = [];
  for (const filename of SCHEMA_FILES) {
    const target = path.join(outputDir, filename);
    const source = path.join(sourceDir, filename);
    const schema = await readJson(source);
    await writeJson(target, schema);
    written.push(target);
  }
  return written;
}
