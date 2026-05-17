import type { AtomPluginDefinition } from "@typegaro/atom-plugin";
import type {
  AgentHookName,
  PanelHandle,
  PluginAgentContext,
  PluginAgentHookDefinition,
  PluginCapabilityName,
  PluginComputedManifest,
  PluginCoreEventDefinition,
  PluginEventMap,
  PluginInputEventDefinition,
  PluginPanel,
  PluginRuntimeEventDefinition,
  PluginSetupContext
} from "@typegaro/atom-plugin";
import { requireCapability, validateEventDefinition } from "./runtime-context";

// PluginSetupRegistry is the mutable builder behind `plugin.setup()`.
//
// Plugin authors register hooks, events, and panel handles against this object
// once at load time. The runtime then snapshots the collected definitions into a
// simpler immutable plugin representation for hot-path lookups.
export class PluginSetupRegistry {
  readonly pluginId: string;
  readonly capabilities: Set<PluginCapabilityName>;
  readonly handlers = new Map<string, ((data: unknown) => void | Promise<void>)[]>();
  readonly hookHandlers = new Map<string, ((context: PluginAgentContext, ...args: unknown[]) => void | Promise<void>)[]>();
  readonly coreEvents: PluginCoreEventDefinition[] = [];
  readonly agentHooks: PluginAgentHookDefinition[] = [];
  readonly inputHandlers: PluginInputEventDefinition[] = [];
  readonly runtimeEvents = new Map<string, PluginRuntimeEventDefinition>();
  readonly panels: Map<string, PluginPanel>;
  readonly context: PluginSetupContext;

  constructor(definition: Pick<AtomPluginDefinition, "id" | "capabilities" | "panels">) {
    this.pluginId = definition.id;
    this.capabilities = new Set(definition.capabilities);
    this.panels = new Map<string, PluginPanel>(
      (definition.panels ?? []).map((panel) => [
        panel.id,
        {
          id: panel.id,
          placement: panel.placement,
          state: panel.initialState ?? { lines: [], visible: true }
        }
      ])
    );

    this.context = {
      hooks: {
        onEvent: <K extends keyof PluginEventMap>(event: PluginCoreEventDefinition<K>) => this.registerCoreEvent(event),
        registerHook: <K extends AgentHookName>(hook: PluginAgentHookDefinition<K>) => this.registerHook(hook)
      },
      events: {
        registerInputHandler: (handler) => this.registerInputHandler(handler),
        registerRuntimeEvent: (event) => this.registerRuntimeEvent(event)
      },
      panels: {
        get: (id) => this.getPanelHandle(id)
      }
    };
  }

  toManifest(): PluginComputedManifest {
    return {
      inputEvents: this.inputHandlers.map(({ type, description }) => ({ type, description })),
      runtimeEvents: Array.from(this.runtimeEvents.values()).map(({ type, description, replay }) => ({ type, description, replay })),
      coreEvents: this.coreEvents.map(({ type, description }) => ({ type, description })),
      agentHooks: this.agentHooks.map(({ name, description }) => ({ name, description }))
    };
  }

  private registerCoreEvent<K extends keyof PluginEventMap>(definition: PluginCoreEventDefinition<K>): PluginCoreEventDefinition<K> {
    requireCapability(this.pluginId, this.capabilities, "hooks");
    validateEventDefinition(this.pluginId, definition.type, definition.description, "core event");

    if (this.coreEvents.some((event) => event.type === definition.type)) {
      throw new Error(`Plugin "${this.pluginId}" registered duplicate core event "${definition.type}"`);
    }

    const list = this.handlers.get(definition.type) ?? [];
    list.push(definition.handle as (data: unknown) => void | Promise<void>);
    this.handlers.set(definition.type, list);
    this.coreEvents.push(definition);
    return definition;
  }

  private registerHook<K extends AgentHookName>(definition: PluginAgentHookDefinition<K>): PluginAgentHookDefinition<K> {
    requireCapability(this.pluginId, this.capabilities, "hooks");
    validateEventDefinition(this.pluginId, definition.name, definition.description, "agent hook");

    if (this.agentHooks.some((hook) => hook.name === definition.name)) {
      throw new Error(`Plugin "${this.pluginId}" registered duplicate agent hook "${definition.name}"`);
    }

    const list = this.hookHandlers.get(definition.name) ?? [];
    list.push(definition.handle as (context: PluginAgentContext, ...args: unknown[]) => void | Promise<void>);
    this.hookHandlers.set(definition.name, list);
    this.agentHooks.push(definition);
    return definition;
  }

  private registerInputHandler(definition: PluginInputEventDefinition): PluginInputEventDefinition {
    requireCapability(this.pluginId, this.capabilities, "hooks");
    validateEventDefinition(this.pluginId, definition.type, definition.description, "input");

    if (this.inputHandlers.some((handler) => handler.type === definition.type)) {
      throw new Error(`Plugin "${this.pluginId}" registered duplicate input event "${definition.type}"`);
    }

    this.inputHandlers.push(definition);
    return definition;
  }

  private registerRuntimeEvent(definition: PluginRuntimeEventDefinition): PluginRuntimeEventDefinition {
    requireCapability(this.pluginId, this.capabilities, "hooks");
    validateEventDefinition(this.pluginId, definition.type, definition.description, "runtime");

    if (this.runtimeEvents.has(definition.type)) {
      throw new Error(`Plugin "${this.pluginId}" registered duplicate runtime event "${definition.type}"`);
    }

    this.runtimeEvents.set(definition.type, definition);
    return definition;
  }

  private getPanelHandle(id: string): PanelHandle {
    requireCapability(this.pluginId, this.capabilities, "panels");

    const panel = this.panels.get(id);

    if (!panel) {
      throw new Error(`Unknown panel: ${id}`);
    }

    return {
      update(state) {
        panel.state = state;
      }
    };
  }
}
