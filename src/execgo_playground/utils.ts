import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export async function ensureDir(target: string): Promise<string> {
  await mkdir(target, { recursive: true });
  return target;
}

export async function writeJson(target: string, data: unknown): Promise<string> {
  await ensureDir(path.dirname(target));
  await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return target;
}

export async function writeJsonl(target: string, rows: unknown[]): Promise<string> {
  await ensureDir(path.dirname(target));
  await writeFile(target, `${rows.map((row) => JSON.stringify(row)).join("\n")}${rows.length ? "\n" : ""}`, "utf8");
  return target;
}

export async function writeText(target: string, content: string): Promise<string> {
  await ensureDir(path.dirname(target));
  await writeFile(target, content, "utf8");
  return target;
}

export async function readJson<T = unknown>(target: string): Promise<T> {
  return JSON.parse(await readFile(target, "utf8")) as T;
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(target: string): Promise<string> {
  return createHash("sha256").update(await readFile(target)).digest("hex");
}

export function deepGet(payload: unknown, dottedPath: string): unknown {
  let current = payload;
  if (!dottedPath) {
    return current;
  }
  for (const rawPart of dottedPath.split(".")) {
    if (!rawPart) {
      continue;
    }
    if (Array.isArray(current)) {
      current = current[Number(rawPart)];
      continue;
    }
    if (!current || typeof current !== "object") {
      throw new Error(dottedPath);
    }
    current = (current as Record<string, unknown>)[rawPart];
  }
  if (current === undefined) {
    throw new Error(dottedPath);
  }
  return current;
}

export function deepSet(payload: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split(".").filter(Boolean);
  if (parts.length === 0) {
    throw new Error("target path must not be empty");
  }
  let current: unknown = payload;
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      current = current[Number(part)];
      continue;
    }
    if (!current || typeof current !== "object") {
      throw new Error(dottedPath);
    }
    const container = current as Record<string, unknown>;
    if (container[part] === undefined || container[part] === null) {
      container[part] = {};
    }
    current = container[part];
  }
  const finalKey = parts.at(-1)!;
  if (Array.isArray(current)) {
    current[Number(finalKey)] = value;
  } else if (current && typeof current === "object") {
    (current as Record<string, unknown>)[finalKey] = value;
  } else {
    throw new Error(dottedPath);
  }
}

export async function copyTree(src: string, dst: string): Promise<void> {
  await rm(dst, { force: true, recursive: true });
  await cp(src, dst, { force: true, recursive: true });
}

export function envFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function listDirsWithFile(root: string, fileName: string): Promise<string[]> {
  if (!(await pathExists(root))) {
    return [];
  }
  const output: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && (await pathExists(path.join(root, entry.name, fileName)))) {
      output.push(entry.name);
    }
  }
  return output.sort();
}

export async function listJsonStems(root: string): Promise<string[]> {
  if (!(await pathExists(root))) {
    return [];
  }
  const output: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      output.push(path.basename(entry.name, ".json"));
    }
  }
  return output.sort();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
