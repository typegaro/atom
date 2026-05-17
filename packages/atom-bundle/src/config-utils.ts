import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getConfigPaths } from "@typegaro/atom-types";

export type ConfigScope = "global" | "local";

export function readJsonFileIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function tryReadJsonFile<T>(path: string): T | undefined {
  try {
    return readJsonFileIfExists<T>(path);
  } catch {
    return undefined;
  }
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function listScopedPaths(globalPath: string, localPath: string, cwd = process.cwd()): Array<[string, ConfigScope]> {
  const result: Array<[string, ConfigScope]> = [[globalPath, "global"]];
  const { localConfigDir } = getConfigPaths(cwd);

  if (existsSync(localConfigDir) && localPath !== globalPath) {
    result.push([localPath, "local"]);
  }

  return result;
}
