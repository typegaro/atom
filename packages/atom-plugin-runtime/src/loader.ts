import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PluginSourceLocator, type PluginSource } from "./plugin-source-locator";
import type { AtomPluginDefinition } from "@typegaro/atom-plugin";
import { RuntimePlugin, type PluginLoader } from "./runtime-plugin";

const require = createRequire(import.meta.url);
const RUNTIME_PACKAGE_ROOTS: Record<string, string> = {
  "@typegaro/atom-plugin": resolveInstalledPackageRoot("@typegaro/atom-plugin")
};

export async function createPlugin(definition: AtomPluginDefinition): Promise<RuntimePlugin> {
  return RuntimePlugin.fromDefinition(definition);
}

async function loadPluginSource(source: PluginSource): Promise<RuntimePlugin> {
  ensureRuntimePackageLinks(source.rootDir);
  const mod = await import(`${pathToFileURL(source.path).href}?t=${Date.now()}`);
  const definition = mod.default as AtomPluginDefinition | undefined;

  if (!isValidPluginDefinition(definition)) {
    throw new Error(`Invalid plugin definition in ${source.path}`);
  }

  return await createPlugin(definition);
}

// Loads plugins either from the filesystem or from explicit loaders, then
// deduplicates them by plugin id with the last definition winning. We validate
// input-event ownership here because conflicting handlers are ambiguous at run
// time and much harder to diagnose later.
export async function loadPlugins(loaders: PluginLoader[] = [], allowList?: Set<string>, cwd = process.cwd()): Promise<RuntimePlugin[]> {
  let sources = loaders.length > 0
    ? undefined
    : new PluginSourceLocator(cwd).listSources();

  if (sources && allowList) {
    sources = sources.filter((source) => allowList.has(source.name));
  }

  const loaded = sources
    ? await Promise.all(sources.map((source) => loadPluginSource(source)))
    : (await Promise.all(loaders.map((loader) => loader.load()))).flat();

  const plugins = new Map<string, RuntimePlugin>();
  for (const plugin of loaded) {
    plugins.delete(plugin.id);
    plugins.set(plugin.id, plugin);
  }
  const deduped = Array.from(plugins.values());
  validateInputEventCollisions(deduped);
  return deduped;
}

function validateInputEventCollisions(plugins: RuntimePlugin[]): void {
  const owners = new Map<string, string[]>();

  for (const plugin of plugins) {
    for (const event of plugin.manifest.inputEvents) {
      const list = owners.get(event.type) ?? [];
      list.push(plugin.id);
      owners.set(event.type, list);
    }
  }

  for (const [type, pluginIds] of owners) {
    if (pluginIds.length > 1) {
      throw new Error(`Multiple plugins handle input event "${type}": ${pluginIds.join(", ")}`);
    }
  }
}

function ensureRuntimePackageLinks(dir: string): void {
  const nodeModulesDir = resolve(dir, "node_modules");

  mkdirSync(nodeModulesDir, { recursive: true });

  for (const [packageName, packageRoot] of Object.entries(RUNTIME_PACKAGE_ROOTS)) {
    const linkPath = resolve(nodeModulesDir, packageName);

    if (existsSync(linkPath)) {
      const stat = lstatSync(linkPath);

      if (stat.isSymbolicLink()) {
        continue;
      }

      continue;
    }

    mkdirSync(resolve(linkPath, ".."), { recursive: true });
    symlinkSync(packageRoot, linkPath, "dir");
  }
}

function resolveInstalledPackageRoot(packageName: string): string {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    return resolve(packageJsonPath, "..");
  } catch {
    // Bun workspaces don't always materialize node_modules links. Walking up
    // from the resolved module entry lets local workspace packages behave like
    // installed dependencies from the plugin loader's perspective.
    const entryPath = fileURLToPath(import.meta.resolve(packageName));
    let dir = resolve(entryPath, "..");
    while (true) {
      const pkgJsonPath = resolve(dir, "package.json");
      if (existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
          if (pkg.name === packageName) return dir;
        } catch {}
      }
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    throw new Error(`Could not find package root for ${packageName}`);
  }
}

function isValidPluginDefinition(definition: AtomPluginDefinition | undefined): definition is AtomPluginDefinition {
  return Boolean(
    definition
    && typeof definition === "object"
    && typeof definition.id === "string"
    && definition.id.trim().length > 0
    && Array.isArray(definition.capabilities)
  );
}
