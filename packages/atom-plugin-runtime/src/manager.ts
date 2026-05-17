import type { ToolDefinition } from "atom-ai";
import { PluginViewActivations, PluginViewPlacements } from "@typegaro/atom-plugin";
import { loadPlugins } from "./loader";
import type { AgentHookMap, AgentHookName, InputEvent, PluginAgentContext, PluginComputedManifest, PluginEventMap, PluginPanel, PluginTool, PluginView } from "@typegaro/atom-plugin";
import type { LoadedPluginBackground, LoadedPluginChannel, LoadedPluginCliCommand, PluginLoader, RuntimePlugin } from "./runtime-plugin";

// PluginManager is the runtime index over already-loaded plugins. It keeps the
// hot paths simple: lookup tools by name, iterate event handlers in load order,
// and expose flattened views/panels/backgrounds to the app layer.
export class PluginManager {
  private loaded = false;
  private loading?: Promise<void>;
  private readonly plugins: RuntimePlugin[] = [];
  private readonly pluginTools = new Map<string, PluginTool>();

  constructor(
    private readonly loaders: PluginLoader[] = [],
    private readonly allowList?: Set<string>,
    private readonly cwd = process.cwd()
  ) {}

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIfNeeded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = (async () => {
      const plugins = await loadPlugins(this.loaders, this.allowList, this.cwd);
      this.plugins.length = 0;
      this.plugins.push(...plugins);
      this.rebuildPluginTools();
      this.loaded = true;
    })();

    try {
      await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  getView(id: string): PluginView | undefined {
    return this.allViews().find((view) => view.id === id);
  }

  getAutoViews(): PluginView[] {
    return this.allViews().filter((view) => this.viewActivation(view) === PluginViewActivations.Auto);
  }

  getCommandViews(): PluginView[] {
    return this.allViews().filter((view) => this.viewActivation(view) === PluginViewActivations.Command);
  }

  getPanels(): PluginPanel[] {
    return this.collectFromPlugins((plugin) => Array.from(plugin.panels.values()));
  }

  getCliCommands(): LoadedPluginCliCommand[] {
    return this.collectFromPlugins((plugin) => plugin.cliCommands);
  }

  getChannels(): LoadedPluginChannel[] {
    return this.collectFromPlugins((plugin) => plugin.channels);
  }

  getChannel(id: string): LoadedPluginChannel | undefined {
    return this.getChannels().find((channel) => channel.id === id);
  }

  getBackgrounds(): LoadedPluginBackground[] {
    return this.collectFromPlugins((plugin) => plugin.backgrounds);
  }

  getAutoStartBackgrounds(): LoadedPluginBackground[] {
    return this.getBackgrounds().filter((background) => background.autoStart);
  }

  getAgentPromptFragments(): string[] {
    return this.getAgentPromptShards().map((shard) => shard.content);
  }

  getAgentPromptShards(): Array<{ source: string; content: string }> {
    return this.plugins
      .map((plugin) => ({ source: `plugin:${plugin.id}`, content: plugin.instructions?.trim() ?? "" }))
      .filter((shard) => Boolean(shard.content));
  }

  getAgentToolDefinitions(): ToolDefinition[] {
    return Array.from(this.pluginTools.values()).map(({ run: _run, ...tool }) => tool);
  }

  getPluginManifests(): Array<{ id: string; manifest: PluginComputedManifest }> {
    return this.plugins.map((plugin) => ({ id: plugin.id, manifest: plugin.manifest }));
  }

  getTool(name: string): PluginTool | undefined {
    return this.pluginTools.get(name);
  }

  async emit<K extends keyof PluginEventMap>(event: K, data: PluginEventMap[K]): Promise<void> {
    for (const plugin of this.plugins) {
      const handlers = plugin.handlers.get(event);
      if (!handlers) {
        continue;
      }

      for (const handler of handlers) {
        await handler(data);
      }
    }
  }

  // Hooks run sequentially so plugins observe a stable order and can build on
  // mutations made by earlier hooks in the same phase.
  async dispatchHook<K extends AgentHookName>(name: K, ...args: Parameters<AgentHookMap[K]>): Promise<void> {
    const [baseContext, ...rest] = args;

    for (const plugin of this.plugins) {
      const handlers = plugin.hookHandlers.get(name);
      if (!handlers) {
        continue;
      }

      const pluginContext = plugin.createAgentContext(baseContext);

      for (const handler of handlers) {
        await handler(pluginContext, ...rest);
      }
    }
  }

  async handleInput(context: PluginAgentContext, event: InputEvent): Promise<boolean> {
    let handled = false;

    for (const plugin of this.plugins) {
      if (plugin.inputHandlers.length === 0) {
        continue;
      }

      const pluginContext = plugin.createAgentContext(context);

      for (const handler of plugin.inputHandlers) {
        handled = (await handler.handle(pluginContext, event)) === true || handled;
      }
    }

    return handled;
  }

  private allViews(): PluginView[] {
    return this.collectFromPlugins((plugin) => plugin.views);
  }

  private collectFromPlugins<T>(select: (plugin: RuntimePlugin) => T[]): T[] {
    return this.plugins.flatMap(select);
  }

  /** Reload plugin indexes from already-loaded plugins. */
  reload(): void {
    this.dedupePlugins();
    this.rebuildPluginTools();
  }

  private dedupePlugins(): void {
    const deduped = new Map<string, RuntimePlugin>();

    for (const plugin of this.plugins) {
      deduped.delete(plugin.id);
      deduped.set(plugin.id, plugin);
    }

    this.plugins.length = 0;
    this.plugins.push(...deduped.values());
  }

  private rebuildPluginTools(): void {
    this.pluginTools.clear();
    for (const plugin of this.plugins) {
      for (const tool of plugin.tools ?? []) {
        this.pluginTools.set(tool.name, tool);
      }
    }
  }

  private viewActivation(view: PluginView) {
    if (view.activation) {
      return view.activation;
    }

    return (view.placement ?? PluginViewPlacements.Body) === PluginViewPlacements.Footer
      ? PluginViewActivations.Auto
      : PluginViewActivations.Command;
  }
}
