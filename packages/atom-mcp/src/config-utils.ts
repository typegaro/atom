import { existsSync, readFileSync } from "node:fs";
import type { AtomConfigPaths } from "@typegaro/atom-types";
import { getConfigPaths } from "@typegaro/atom-types";

export type ConfigScope = "global" | "local";

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function listScopedPaths(globalPath: string, localPath: string, cwd = process.cwd()): Array<[string, ConfigScope]> {
  const result: Array<[string, ConfigScope]> = [[globalPath, "global"]];
  const { localConfigDir } = getConfigPaths(cwd) satisfies AtomConfigPaths;

  if (existsSync(localConfigDir) && localPath !== globalPath) {
    result.push([localPath, "local"]);
  }

  return result;
}
