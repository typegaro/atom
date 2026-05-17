import type { AgentRuntime, ModelSelection, AvailableModelSettings } from "atom-ai";
import { ProviderRegistry } from "atom-ai";
import { PluginManager, type PluginLoader } from "atom-plugin-runtime";
import type { McpManager } from "atom-mcp";
import { RemoteMcpManager } from "atom-mcp";
import { BundleStore, type ResolvedBundle } from "./bundle-store";
import { SkillManager } from "./skill-manager";
import type { AgentBundle } from "./agent-bundle";
import { DEFAULT_SYSTEM_PROMPT, loadWorkspaceInstructions, buildSystemPromptShards } from "./prompt";
import { buildCoreTools } from "./tools";

export interface AgentBundleManagerOptions {
  cwd?: string;
  /** Resolve allow-lists from this named bundle in bundles.json. */
  bundleName?: string;
  pluginLoaders?: PluginLoader[];
  /** Explicit override — wins over the named bundle. */
  pluginAllowList?: Set<string>;
  /** Explicit override — wins over the named bundle. */
  mcpAllowList?: Set<string>;
  /** Explicit override — wins over the named bundle. */
  skillAllowList?: Set<string>;
  includeMcp?: boolean;
}

// AgentBundleManager is the single integration point for loading all three
// resource types (plugins, MCP servers, skills) and assembling AgentBundle
// objects from them. It replaces the old AgentRuntimeServices.
//
// Usage:
//   const mgr = new AgentBundleManager({ bundleName: "code-review", includeMcp: true });
//   await mgr.loadIfNeeded();
//   const bundle = await mgr.getBundle();
//   const agent = new AtomAgent({ runtime, bundle });
export class AgentBundleManager {
  readonly providerRegistry: ProviderRegistry;
  readonly pluginManager: PluginManager;
  readonly skillManager: SkillManager;
  readonly mcpManager?: McpManager;
  readonly bundleStore: BundleStore;
  readonly cwd: string;
  readonly resolvedBundle?: ResolvedBundle;

  private loaded = false;
  private bundles = new Map<string, AgentBundle>();

  constructor(options: AgentBundleManagerOptions = {}) {
    const cwd = options.cwd ?? process.cwd();
    this.cwd = cwd;
    this.providerRegistry = new ProviderRegistry(cwd);
    this.bundleStore = new BundleStore(cwd);

    // Resolve allow-lists: named bundle is the default, explicit options override.
    this.resolvedBundle = options.bundleName
      ? this.bundleStore.resolve(options.bundleName)
      : undefined;

    this.pluginManager = new PluginManager(
      options.pluginLoaders ?? [],
      options.pluginAllowList ?? this.resolvedBundle?.pluginAllowList,
      cwd
    );
    this.skillManager = new SkillManager(
      cwd,
      options.skillAllowList ?? this.resolvedBundle?.skillAllowList
    );
    this.mcpManager = options.includeMcp
      ? new RemoteMcpManager(cwd, options.mcpAllowList ?? this.resolvedBundle?.mcpAllowList)
      : undefined;
  }

  /** The default model from the resolved bundle, if any. */
  getDefaultModel(): string | undefined {
    return this.resolvedBundle?.model;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIfNeeded(): Promise<void> {
    if (this.loaded) return;

    await Promise.all([
      this.pluginManager.loadIfNeeded(),
      this.skillManager.loadIfNeeded(),
      this.mcpManager?.loadIfNeeded()
    ]);

    this.loaded = true;
  }

  /** Build (or retrieve from cache) an AgentBundle by name. */
  async getBundle(name?: string): Promise<AgentBundle> {
    await this.loadIfNeeded();

    const bundleName = name ?? "default";
    const cached = this.bundles.get(bundleName);
    if (cached) return cached;

    // Resolve the bundle to get the default model for this specific name,
    // falling back to the construction-time resolved bundle.
    const def = name
      ? this.bundleStore.resolve(name)
      : this.resolvedBundle;

    const tools = [
      ...buildCoreTools(this.skillManager.getAll()),
      ...this.pluginManager.getAgentToolDefinitions(),
      ...(this.mcpManager?.getToolDefinitions() ?? [])
    ];

    const workspaceInstructions = loadWorkspaceInstructions(this.cwd);

    const pluginShards = this.pluginManager.getAgentPromptShards();
    const bundleSystemPrompt = def?.systemPrompt;

    const promptShards = buildSystemPromptShards(
      DEFAULT_SYSTEM_PROMPT,
      workspaceInstructions,
      bundleSystemPrompt
        ? [...pluginShards, { source: `bundle:${bundleName}`, content: bundleSystemPrompt }]
        : pluginShards,
      this.skillManager.getAll()
    );

    const bundle: AgentBundle = {
      name: bundleName,
      model: def?.model,
      systemPrompt: bundleSystemPrompt,
      tags: def?.tags,
      tools,
      promptShards,
      skills: this.skillManager.getAll(),
      pluginManager: this.pluginManager,
      mcpManager: this.mcpManager,
      workspaceInstructions
    };

    this.bundles.set(bundleName, bundle);
    return bundle;
  }

  /** List available models from the provider registry. */
  async listModels(provider?: string): Promise<AvailableModelSettings[]> {
    await this.loadIfNeeded();
    return this.providerRegistry.listModels(provider);
  }

  /** Create an agent runtime for the given model selection. */
  async createAgentRuntime(selection: ModelSelection): Promise<AgentRuntime> {
    await this.loadIfNeeded();
    return this.providerRegistry.createAgentRuntime(selection);
  }

  /** Reload a cached bundle — clears cache so next getBundle() re-reads config. */
  async reload(name?: string): Promise<void> {
    this.bundles.delete(name ?? "default");
  }
}
