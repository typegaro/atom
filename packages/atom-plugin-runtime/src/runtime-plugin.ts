import {
  PluginRuntimeContextView,
  type PluginRuntime,
  PluginAgentContextView
} from "./runtime-context";
import { PluginSetupRegistry } from "./plugin-setup-registry";
import type {
  AtomPluginDefinition,
  PluginAgentContext,
  PluginAgentHookDefinition,
  PluginCapabilityName,
  PluginCliCommand,
  PluginComputedManifest,
  PluginCoreEventDefinition,
  PluginInputEventDefinition,
  PluginPanel,
  PluginRuntimeEventDefinition,
  PluginTool,
  PluginView,
  PluginChannel,
  PluginBackground
} from "@typegaro/atom-plugin";

export interface LoadedPluginCliCommand {
  register(program: unknown, host: unknown): void | Promise<void>;
}

export interface LoadedPluginChannel {
  id: string;
  start(host: unknown): Promise<void> | void;
}

export interface LoadedPluginBackground {
  id: string;
  autoStart?: boolean;
  start(host: unknown): Promise<void> | void;
}

// PluginCliCommandRuntime adapts a plugin CLI definition to the loaded runtime
// interface and injects the capability-scoped host context on registration.
export class PluginCliCommandRuntime implements LoadedPluginCliCommand {
  constructor(
    private readonly plugin: RuntimePlugin,
    private readonly command: PluginCliCommand
  ) {}

  register(program: unknown, host: unknown): void | Promise<void> {
    return this.command.register(program as never, this.plugin.createRuntimeContext(host as PluginRuntime));
  }
}

// PluginChannelRuntime wraps a channel definition so the host can start it
// later without redoing context setup or knowing plugin internals.
export class PluginChannelRuntime implements LoadedPluginChannel {
  readonly id: string;

  constructor(
    private readonly plugin: RuntimePlugin,
    private readonly channel: PluginChannel
  ) {
    this.id = channel.id;
  }

  start(host: unknown): Promise<void> | void {
    return this.channel.start(this.plugin.createRuntimeContext(host as PluginRuntime));
  }
}

// PluginBackgroundRuntime does the same wrapping for background jobs, including
// exposing whether they should auto-start during app initialization.
export class PluginBackgroundRuntime implements LoadedPluginBackground {
  readonly id: string;
  readonly autoStart?: boolean;

  constructor(
    private readonly plugin: RuntimePlugin,
    private readonly background: PluginBackground
  ) {
    this.id = background.id;
    this.autoStart = background.autoStart;
  }

  start(host: unknown): Promise<void> | void {
    return this.background.start(this.plugin.createRuntimeContext(host as PluginRuntime));
  }
}

// RuntimePlugin is the loaded, immutable view of one plugin definition.
//
// Setup-time registration is resolved up front so the rest of the runtime can
// work with flattened hooks, tools, views, and commands without re-running user
// plugin code on every lookup or event dispatch.
export class RuntimePlugin {
  readonly id: string;
  readonly capabilities: Set<PluginCapabilityName>;
  readonly manifest: PluginComputedManifest;
  readonly instructions?: string;
  readonly tools?: PluginTool[];
  readonly handlers: Map<string, ((data: unknown) => void | Promise<void>)[]>;
  readonly hookHandlers: Map<string, ((context: PluginAgentContext, ...args: unknown[]) => void | Promise<void>)[]>;
  readonly inputHandlers: PluginInputEventDefinition[];
  readonly runtimeEvents: Map<string, PluginRuntimeEventDefinition>;
  readonly coreEvents: PluginCoreEventDefinition[];
  readonly agentHooks: PluginAgentHookDefinition[];
  readonly views: PluginView[];
  readonly panels: Map<string, PluginPanel>;
  readonly cliCommands: LoadedPluginCliCommand[];
  readonly channels: LoadedPluginChannel[];
  readonly backgrounds: LoadedPluginBackground[];

  private constructor(definition: AtomPluginDefinition, setup: PluginSetupRegistry) {
    this.id = definition.id;
    this.capabilities = setup.capabilities;
    this.manifest = setup.toManifest();
    this.instructions = definition.instructions?.join("\n");
    this.tools = definition.tools;
    this.handlers = setup.handlers;
    this.hookHandlers = setup.hookHandlers;
    this.inputHandlers = setup.inputHandlers;
    this.runtimeEvents = setup.runtimeEvents;
    this.coreEvents = setup.coreEvents;
    this.agentHooks = setup.agentHooks;
    this.views = definition.views ?? [];
    this.panels = setup.panels;
    this.cliCommands = (definition.cliCommands ?? []).map((command) => new PluginCliCommandRuntime(this, command));
    this.channels = (definition.channels ?? []).map((channel) => new PluginChannelRuntime(this, channel));
    this.backgrounds = (definition.backgrounds ?? []).map((background) => new PluginBackgroundRuntime(this, background));
  }

  static async fromDefinition(definition: AtomPluginDefinition): Promise<RuntimePlugin> {
    const setup = new PluginSetupRegistry(definition);
    await definition.setup?.(setup.context);
    return new RuntimePlugin(definition, setup);
  }

  createRuntimeContext(host: PluginRuntime) {
    return new PluginRuntimeContextView(this.id, host, this.capabilities);
  }

  createAgentContext(context: PluginAgentContext): PluginAgentContext {
    return new PluginAgentContextView(this.id, context, this.capabilities);
  }
}

export interface PluginLoader {
  load(): Promise<RuntimePlugin[]>;
}
