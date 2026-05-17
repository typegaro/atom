import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { basename, resolve } from "node:path";
import { getConfigPaths } from "@typegaro/atom-types";
import { listScopedPaths, tryReadJsonFile, type ConfigScope } from "./config-utils";

export type { ConfigScope };

export interface PluginSource {
  name: string;
  path: string;
  rootDir: string;
  scope: ConfigScope;
}

// Plugin discovery intentionally supports a few entry shapes instead of a full
// package loader abstraction: loose files, plugin directories, and installed
// npm packages that declare `atom.plugins`. Local sources override global ones
// by name so a workspace can replace a user-level plugin without extra config.
export class PluginSourceLocator {
  constructor(private readonly cwd = process.cwd()) {}

  listSources(): PluginSource[] {
    const sources = new Map<string, PluginSource>();
    const paths = getConfigPaths(this.cwd);

    for (const [dir, scope] of listScopedPaths(paths.pluginsDir, paths.localPluginsDir, this.cwd)) {
      if (!existsSync(dir)) {
        continue;
      }

      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        for (const source of this.resolveSourcesForEntry(dir, entry.name, scope)) {
          sources.delete(source.name);
          sources.set(source.name, source);
        }
      }
    }

    for (const [nodeModulesDir, scope] of listScopedPaths(resolve(paths.npmDir, "node_modules"), resolve(paths.localNpmDir, "node_modules"), this.cwd)) {
      if (!existsSync(nodeModulesDir)) {
        continue;
      }

      for (const source of this.listNodeModulesSources(nodeModulesDir, scope)) {
        sources.delete(source.name);
        sources.set(source.name, source);
      }
    }

    return Array.from(sources.values());
  }

  resolveEntryPaths(dir: string, entryName: string): string[] {
    const fullPath = resolve(dir, entryName);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      return [];
    }

    if (stat.isFile() && /\.(ts|js|mjs|mts)$/i.test(entryName)) {
      return [fullPath];
    }

    if (!stat.isDirectory()) {
      return [];
    }

    const manifestEntries = this.readAtomPackagePluginManifest(fullPath);
    if (manifestEntries.length > 0) {
      return manifestEntries;
    }

    for (const indexFile of ["index.ts", "index.js", "index.mjs", "index.mts"]) {
      const candidate = resolve(fullPath, indexFile);
      if (existsSync(candidate)) {
        return [candidate];
      }
    }

    return [];
  }

  private resolveSourcesForEntry(dir: string, entryName: string, scope: ConfigScope): PluginSource[] {
    return this.resolveEntryPaths(dir, entryName).map((path) => ({
      name: this.sourceName(entryName, path),
      path,
      rootDir: resolve(dir, entryName),
      scope
    }));
  }

  private listNodeModulesSources(nodeModulesDir: string, scope: ConfigScope): PluginSource[] {
    const sources: PluginSource[] = [];

    for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
      if (!this.isDirectoryEntry(entry)) {
        continue;
      }

      if (entry.name.startsWith("@")) {
        const scopeDir = resolve(nodeModulesDir, entry.name);

        for (const scopedEntry of readdirSync(scopeDir, { withFileTypes: true })) {
          if (!this.isDirectoryEntry(scopedEntry)) {
            continue;
          }

          sources.push(...this.resolvePackageSources(resolve(scopeDir, scopedEntry.name), scope));
        }

        continue;
      }

      sources.push(...this.resolvePackageSources(resolve(nodeModulesDir, entry.name), scope));
    }

    return sources;
  }

  private resolvePackageSources(packageRoot: string, scope: ConfigScope): PluginSource[] {
    if (!existsSync(packageRoot)) {
      return [];
    }

    const packageName = this.readPackageName(packageRoot) ?? basename(packageRoot);
    const manifest = this.readAtomPackagePluginManifest(packageRoot);
    if (manifest.length === 0) {
      return [];
    }

    return manifest.map((path, index) => ({
      name: index === 0 ? packageName : `${packageName}:${basename(path).replace(/\.(js|mjs|cjs)$/i, "")}`,
      path,
      rootDir: packageRoot,
      scope
    }));
  }

  private isDirectoryEntry(entry: Dirent): boolean {
    if (entry.isDirectory()) {
      return true;
    }

    if (entry.isSymbolicLink()) {
      try {
        return statSync(resolve(entry.parentPath, entry.name)).isDirectory();
      } catch {
        return false;
      }
    }

    return false;
  }

  private readPackageName(packageRoot: string): string | undefined {
    const manifestPath = resolve(packageRoot, "package.json");
    const parsed = tryReadJsonFile<{ name?: unknown }>(manifestPath);
    if (!parsed) {
      return undefined;
    }

    return typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : undefined;
  }

  private readAtomPackagePluginManifest(packageRoot: string): string[] {
    const manifestPath = resolve(packageRoot, "package.json");
    const parsed = tryReadJsonFile<{ atom?: { plugins?: unknown } }>(manifestPath);
    const plugins = parsed?.atom?.plugins;
    if (!Array.isArray(plugins)) {
      return [];
    }

    return plugins
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => resolve(packageRoot, entry))
      .filter((entry) => existsSync(entry));
  }

  private sourceName(entryName: string, path: string): string {
    const base = entryName.replace(/\.(ts|js|mjs|mts)$/i, "");
    const file = basename(path).replace(/\.(ts|js|mjs|mts)$/i, "");
    return file === "index" ? base : `${base}:${file}`;
  }
}
