import { getConfigPaths } from "@typegaro/atom-types";
import { tryReadJsonFile, writeJsonFile, type ConfigScope } from "./config-utils";

export type { ConfigScope };

// A generic named entry inside a bundle, used to register typed items
// (e.g. pipeline node types) that can be discovered by tag.
export interface BundleEntry {
  tags?: string[];
  data?: Record<string, unknown>;
}

// BundleDefinition describes a named bundle that controls which plugins, MCP
// servers, and skills are exposed to the agent, plus a default model to use.
export interface BundleDefinition {
  /** Plugin names to include (default: all discovered). Legacy string[] also accepted. */
  plugins?: string[];
  /** MCP server names to include (default: all discovered). */
  mcp?: string[];
  /** Skill names to include (default: all discovered). */
  skills?: string[];
  /** Default model id for agents created with this bundle. */
  model?: string;
  /** Optional system prompt shard appended to the agent's base prompt. */
  systemPrompt?: string;
  /** Tags for categorising/organising bundles. */
  tags?: string[];
  /** Generic typed entries discoverable by tag (e.g. pipeline-node types). */
  items?: Record<string, BundleEntry>;
}

// ResolvedBundle is the processed, normalised view ready to be passed to managers
// as allow-lists.
export interface ResolvedBundle {
  name: string;
  pluginAllowList?: Set<string>;
  mcpAllowList?: Set<string>;
  skillAllowList?: Set<string>;
  model?: string;
  systemPrompt?: string;
  tags?: string[];
}

// BundleStore manages the small config files that map bundle names to
// plugin/MCP/skill allow-lists and default model across global and workspace
// scopes. Local bundles override global ones by name.
export class BundleStore {
  constructor(private readonly cwd = process.cwd()) {}

  listBundleNames(load: Record<string, BundleDefinition> = this.load()): string[] {
    return Object.keys(load);
  }

  resolve(bundleName: string): ResolvedBundle | undefined {
    const all = this.load();
    const raw = all[bundleName];
    if (!raw) return undefined;

    return {
      name: bundleName,
      pluginAllowList: raw.plugins ? new Set(raw.plugins) : undefined,
      mcpAllowList: raw.mcp ? new Set(raw.mcp) : undefined,
      skillAllowList: raw.skills ? new Set(raw.skills) : undefined,
      model: raw.model,
      systemPrompt: raw.systemPrompt,
      tags: raw.tags
    };
  }

  load(): Record<string, BundleDefinition> {
    const result: Record<string, BundleDefinition> = {};

    for (const path of [this.paths().bundles, this.paths().localBundles]) {
      const parsed = this.readFile(path);
      for (const [name, def] of Object.entries(parsed)) {
        result[name] = def;
      }
    }

    return result;
  }

  resolvePlugins(bundleName: string): string[] | undefined {
    return this.resolve(bundleName)?.pluginAllowList
      ? Array.from(this.resolve(bundleName)!.pluginAllowList!)
      : undefined;
  }

  loadScope(scope: ConfigScope): Record<string, BundleDefinition> {
    return this.readFile(this.pathForScope(scope));
  }

  saveScope(scope: ConfigScope, bundles: Record<string, BundleDefinition>): void {
    writeJsonFile(this.pathForScope(scope), sortBundles(bundles));
  }

  upsert(scope: ConfigScope, bundleName: string, def: BundleDefinition): Record<string, BundleDefinition> {
    const bundles = this.loadScope(scope);
    bundles[bundleName] = normalizeBundleDefinition(def);
    this.saveScope(scope, bundles);
    return bundles;
  }

  delete(scope: ConfigScope, bundleName: string): Record<string, BundleDefinition> {
    const bundles = this.loadScope(scope);
    delete bundles[bundleName];
    this.saveScope(scope, bundles);
    return bundles;
  }

  listItemsByTag(tag: string): { bundleName: string; itemName: string; item: BundleEntry }[] {
    const all = this.load();
    const result: { bundleName: string; itemName: string; item: BundleEntry }[] = [];
    for (const [bundleName, def] of Object.entries(all)) {
      if (!def.items) continue;
      for (const [itemName, item] of Object.entries(def.items)) {
        if (item.tags?.includes(tag)) {
          result.push({ bundleName, itemName, item });
        }
      }
    }
    return result;
  }

  addItem(scope: ConfigScope, bundleName: string, itemName: string, item: BundleEntry): Record<string, BundleEntry> {
    const bundles = this.loadScope(scope);
    const current = bundles[bundleName] ?? {};
    const items = { ...(current.items ?? {}), [itemName]: normalizeBundleEntry(item) };
    bundles[bundleName] = { ...current, items };
    this.saveScope(scope, bundles);
    return bundles[bundleName].items ?? {};
  }

  removeItem(scope: ConfigScope, bundleName: string, itemName: string): Record<string, BundleEntry> {
    const bundles = this.loadScope(scope);
    const current = bundles[bundleName];
    if (!current?.items) return {};
    const { [itemName]: _, ...rest } = current.items;
    bundles[bundleName] = { ...current, items: Object.keys(rest).length > 0 ? rest : undefined };
    this.saveScope(scope, bundles);
    return bundles[bundleName]?.items ?? {};
  }

  addPlugin(scope: ConfigScope, bundleName: string, pluginName: string): string[] {
    const bundles = this.loadScope(scope);
    const current = bundles[bundleName] ?? {};
    const plugins = normalizeBundlePlugins([...(current.plugins ?? []), pluginName]);
    bundles[bundleName] = { ...current, plugins };
    this.saveScope(scope, bundles);
    return plugins;
  }

  removePlugin(scope: ConfigScope, bundleName: string, pluginName: string): string[] {
    const bundles = this.loadScope(scope);
    const current = bundles[bundleName] ?? {};
    const plugins = (current.plugins ?? []).filter((entry) => entry !== pluginName);
    bundles[bundleName] = { ...current, plugins: normalizeBundlePlugins(plugins) };
    this.saveScope(scope, bundles);
    return bundles[bundleName].plugins ?? [];
  }

  private paths() {
    return getConfigPaths(this.cwd);
  }

  private pathForScope(scope: ConfigScope): string {
    const paths = this.paths();
    return scope === "global" ? paths.bundles : paths.localBundles;
  }

  private readFile(path: string): Record<string, BundleDefinition> {
    const parsed = tryReadJsonFile<Record<string, unknown>>(path);
    if (!parsed) return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, normalizeBundleDefinition(value)])
    );
  }
}

// Accept both legacy { "name": ["plugin1", "plugin2"] } and new
// { "name": { "plugins": [...], "mcp": [...], "skills": [...], "model": "..." } } formats.
function normalizeBundleDefinition(value: unknown): BundleDefinition {
  if (Array.isArray(value)) {
    return { plugins: normalizeBundlePlugins(value as string[]) };
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return {
      plugins: normalizeBundlePlugins(asStringArray(obj.plugins)),
      mcp: normalizeBundlePlugins(asStringArray(obj.mcp)),
      skills: normalizeBundlePlugins(asStringArray(obj.skills)),
      model: typeof obj.model === "string" ? obj.model.trim() || undefined : undefined,
      systemPrompt: typeof obj.systemPrompt === "string" ? obj.systemPrompt.trim() || undefined : undefined,
      tags: asStringArray(obj.tags),
      items: normalizeBundleItems(obj.items)
    };
  }

  return {};
}

function normalizeBundleItems(items: unknown): Record<string, BundleEntry> | undefined {
  if (!items || typeof items !== "object") return undefined;
  const result: Record<string, BundleEntry> = {};
  for (const [key, value] of Object.entries(items as Record<string, unknown>)) {
    if (value && typeof value === "object") {
      const entry = value as Record<string, unknown>;
      result[key] = {
        tags: asStringArray(entry.tags),
        data: entry.data && typeof entry.data === "object" ? entry.data as Record<string, unknown> : undefined
      };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeBundleEntry(item: BundleEntry): BundleEntry {
  return {
    tags: item.tags ? [...new Set(item.tags.map((t) => t.trim()).filter(Boolean))].sort() : undefined,
    data: item.data && typeof item.data === "object" ? item.data as Record<string, unknown> : undefined
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((e): e is string => typeof e === "string");
  return [];
}

function normalizeBundlePlugins(plugins: string[]): string[] {
  return Array.from(new Set(plugins.map((entry) => entry.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function sortBundles(bundles: Record<string, BundleDefinition>): Record<string, BundleDefinition> {
  return Object.fromEntries(
    Object.entries(bundles)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, def]) => [
        name,
        {
          ...def,
          plugins: def.plugins ? normalizeBundlePlugins(def.plugins) : undefined,
          tags: def.tags ? [...new Set(def.tags.map((t) => t.trim()).filter(Boolean))].sort() : undefined,
          items: def.items ? Object.fromEntries(
            Object.entries(def.items).sort(([a], [b]) => a.localeCompare(b))
          ) : undefined,
        },
      ])
  );
}
