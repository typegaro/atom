import { AgentBundleManager } from "atom-bundle";
import { getConfigPaths, RuntimeEventType } from "@typegaro/atom-types";
import type { BundleReloadEvent, RuntimeEvent } from "@typegaro/atom-types";
import type { PluginBundleSummary, PluginSessionOptions } from "@typegaro/atom-plugin";
import type { PluginLoader } from "atom-plugin-runtime";
import { AtomAppController, type AtomAppControllerOptions } from "./controller";
import { AtomAppSessionRuntime } from "./session-runtime";

export interface AtomAppRuntimeOptions extends AtomAppControllerOptions {
  pluginLoaders?: PluginLoader[];
  pluginAllowList?: Set<string>;
  mcpAllowList?: Set<string>;
  skillAllowList?: Set<string>;
  bundleName?: string;
}

// AtomAppRuntime is the long-lived host runtime for one workspace process.
//
// It owns shared services like providers, plugins, MCP connections, and
// background tasks, then hands out lightweight controllers and session handles
// for individual conversations on top of that shared state.
export class AtomAppRuntime {
  readonly cwd: string;
  readonly bundleManager: AgentBundleManager;

  private backgroundsPromise?: Promise<void>;
  private readonly sessions = new Map<string, AtomAppSessionRuntime>();
  private readonly defaults: AtomAppControllerOptions;

  constructor(options: AtomAppRuntimeOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.defaults = {
      modelId: options.modelId,
      provider: options.provider,
      includeMcp: options.includeMcp,
      cwd: this.cwd,
      storeSession: options.storeSession,
      sessionKey: options.sessionKey,
      bundleName: options.bundleName
    };
    this.bundleManager = new AgentBundleManager({
      cwd: this.cwd,
      bundleName: options.bundleName,
      pluginLoaders: options.pluginLoaders,
      pluginAllowList: options.pluginAllowList,
      mcpAllowList: options.mcpAllowList,
      skillAllowList: options.skillAllowList,
      includeMcp: options.includeMcp
    });
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.bundleManager.loadIfNeeded(),
      this.ensureBackgroundsStarted()
    ]);
  }

  createController(options: AtomAppControllerOptions = {}): AtomAppController {
    return new AtomAppController(this, {
      modelId: options.modelId ?? this.defaults.modelId,
      provider: options.provider ?? this.defaults.provider,
      includeMcp: options.includeMcp ?? this.defaults.includeMcp,
      cwd: options.cwd ?? this.cwd,
      storeSession: options.storeSession ?? this.defaults.storeSession,
      sessionKey: options.sessionKey ?? this.defaults.sessionKey,
      bundleName: options.bundleName ?? this.defaults.bundleName
    });
  }

  openSession(options: PluginSessionOptions = {}) {
    const key = options.key ?? options.sessionId ?? crypto.randomUUID();
    const existing = this.sessions.get(key);

    if (existing) {
      return existing;
    }

    const controller = this.createController({
      modelId: options.modelId,
      provider: options.provider,
      storeSession: options.storeSession,
      sessionKey: options.key,
      bundleName: options.bundleName
    });

    const session = new AtomAppSessionRuntime({
      controller,
      ready: this.prepareController(controller, options)
    });

    this.sessions.set(key, session);
    return session;
  }

  getConfigPaths() {
    return getConfigPaths(this.cwd);
  }

  listBundles(): string[] {
    return this.bundleManager.bundleStore.listBundleNames();
  }

  getBundle(name: string): PluginBundleSummary | undefined {
    const resolved = this.bundleManager.bundleStore.resolve(name);
    if (!resolved) return undefined;
    return {
      name: resolved.name,
      model: resolved.model,
      systemPrompt: resolved.systemPrompt,
      tags: resolved.tags
    };
  }

  private ensureBackgroundsStarted(): Promise<void> {
    if (this.backgroundsPromise) {
      return this.backgroundsPromise;
    }

    this.backgroundsPromise = (async () => {
      await this.bundleManager.loadIfNeeded();

      for (const background of this.bundleManager.pluginManager.getAutoStartBackgrounds()) {
        await background.start(this);
      }
    })();

    return this.backgroundsPromise;
  }

  /** Process runtime events and handle any that require bundle reloads. */
  async handleRuntimeEvents(events: RuntimeEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === RuntimeEventType.BundleReload) {
        await this.handleBundleReload(event as BundleReloadEvent);
      }
    }
  }

  private async handleBundleReload(event: BundleReloadEvent): Promise<void> {
    const targets = event.targets ?? ["bundle"];
    const bundleName = event.bundleName;

    if (targets.includes("all") || targets.includes("skills")) {
      await this.bundleManager.skillManager.reload();
    }
    if (targets.includes("all") || targets.includes("mcp")) {
      await this.bundleManager.mcpManager?.reload();
    }
    if (targets.includes("all") || targets.includes("plugins")) {
      this.bundleManager.pluginManager.reload();
    }
    if (targets.includes("all") || targets.includes("bundle")) {
      await this.bundleManager.reload(bundleName);
    }
  }

  private async prepareController(controller: AtomAppController, options: PluginSessionOptions): Promise<void> {
    await Promise.all([
      this.initialize(),
      controller.initialize()
    ]);

    if (options.sessionId) {
      controller.loadSession(options.sessionId);
    }
  }
}
