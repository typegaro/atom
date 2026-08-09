import type {
  PluginAgentContext,
  PluginCapabilityName,
  PluginControllerFor,
  PluginRuntimeContext,
  PluginSessionOptions,
  PluginSessionRuntime
} from "@typegaro/atom-plugin";
import { requireCapability, type PluginRuntime } from "./runtime-context";

type ModelSessionTarget = {
  switchModel?(modelId: string): Promise<void>;
  getActiveModelId?(): string | undefined;
  listModels?(): Array<{ id: string }>;
  listSessions?(): ReturnType<PluginControllerFor<"models" | "sessions">["listSessions"]>;
  loadSession?(sessionId: string): ReturnType<PluginControllerFor<"models" | "sessions">["loadSession"]>;
  deleteSession?(sessionId: string): ReturnType<PluginControllerFor<"models" | "sessions">["deleteSession"]>;
  resetSession?(): ReturnType<PluginControllerFor<"models" | "sessions">["resetSession"]>;
};

// ScopedModelSessionAccess centralizes capability checks for model and session
// operations so the view wrappers can stay thin and mostly forward calls.
class ScopedModelSessionAccess {
  constructor(
    private readonly pluginId: string,
    private readonly capabilities: Set<PluginCapabilityName>,
    private readonly target: ModelSessionTarget
  ) {}

  switchModel(modelId: string): Promise<void> {
    return this.withCapability("models", () => this.target.switchModel?.(modelId) ?? Promise.resolve());
  }

  getActiveModelId() {
    return this.withCapability("models", () => this.target.getActiveModelId?.());
  }

  listModels() {
    return this.withCapability("models", () => this.target.listModels?.() ?? []);
  }

  listSessions() {
    return this.withCapability("sessions", () => this.target.listSessions?.() ?? []);
  }

  loadSession(sessionId: string) {
    return this.withCapability("sessions", () => this.target.loadSession?.(sessionId) ?? []);
  }

  deleteSession(sessionId: string) {
    return this.withCapability("sessions", () => this.target.deleteSession?.(sessionId) ?? false);
  }

  resetSession() {
    return this.withCapability("sessions", () => this.target.resetSession?.() ?? Promise.resolve());
  }

  private withCapability<T>(capability: PluginCapabilityName, run: () => T): T {
    requireCapability(this.pluginId, this.capabilities, capability);
    return run();
  }
}

// PluginControllerView narrows a host controller down to the capabilities a
// specific plugin declared, while preserving the same controller shape.
class PluginControllerView implements PluginControllerFor<"models" | "sessions"> {
  private readonly access: ScopedModelSessionAccess;

  constructor(
    private readonly controller: PluginControllerFor<"models" | "sessions">,
    pluginId: string,
    capabilities: Set<PluginCapabilityName>
  ) {
    this.access = new ScopedModelSessionAccess(pluginId, capabilities, controller);
  }

  initialize() {
    return this.controller.initialize();
  }

  submit(input: Parameters<PluginControllerFor<"models" | "sessions">["submit"]>[0]) {
    return this.controller.submit(input);
  }

  send(input: Parameters<PluginControllerFor<"models" | "sessions">["send"]>[0]) {
    return this.controller.send(input);
  }

  interrupt() {
    this.controller.interrupt();
  }

  getTotalUsage() {
    return this.controller.getTotalUsage();
  }

  switchModel(modelId: string) {
    return this.access.switchModel(modelId);
  }

  getActiveModelId() {
    return this.access.getActiveModelId();
  }

  listModels() {
    return this.access.listModels();
  }

  listSessions() {
    return this.access.listSessions();
  }

  loadSession(sessionId: string) {
    return this.access.loadSession(sessionId);
  }

  deleteSession(sessionId: string) {
    return this.access.deleteSession(sessionId);
  }

  resetSession() {
    return this.access.resetSession();
  }

  getActiveBundleName() {
    return this.controller.getActiveBundleName?.();
  }
}

// PluginSessionView does the same capability scoping for detached session
// handles, so plugins can only use the pieces of the session API they earned.
class PluginSessionView implements PluginSessionRuntime<"models" | "sessions"> {
  private readonly access: ScopedModelSessionAccess;

  constructor(
    private readonly session: PluginSessionRuntime<"models" | "sessions">,
    pluginId: string,
    capabilities: Set<PluginCapabilityName>
  ) {
    this.access = new ScopedModelSessionAccess(pluginId, capabilities, session);
  }

  submit(input: Parameters<PluginSessionRuntime<"models" | "sessions">["submit"]>[0]) {
    return this.session.submit(input);
  }

  subscribe(listener: Parameters<PluginSessionRuntime<"models" | "sessions">["subscribe"]>[0]) {
    return this.session.subscribe(listener);
  }

  interrupt() {
    this.session.interrupt();
  }

  close() {
    this.session.close();
  }

  getTotalUsage() {
    return this.session.getTotalUsage();
  }

  supportsImages() {
    return this.session.supportsImages();
  }

  switchModel(modelId: string) {
    return this.access.switchModel(modelId);
  }

  getActiveModelId() {
    return this.access.getActiveModelId();
  }

  listModels() {
    return this.access.listModels();
  }

  listSessions() {
    return this.access.listSessions();
  }

  loadSession(sessionId: string) {
    return this.access.loadSession(sessionId);
  }

  deleteSession(sessionId: string) {
    return this.access.deleteSession(sessionId);
  }

  resetSession() {
    return this.access.resetSession();
  }

  getActiveSystemPrompt() {
    return this.session.getActiveSystemPrompt();
  }

  getActiveSystemPromptShards() {
    return this.session.getActiveSystemPromptShards();
  }

  getActiveBundleName() {
    return this.session.getActiveBundleName();
  }

  ready() {
    return this.session.ready?.() ?? Promise.resolve();
  }
}

// PluginRuntimeContextView is the host-facing runtime surface plugins see
// during setup and long-lived background execution.
export class PluginRuntimeContextView implements PluginRuntimeContext {
  readonly runtime: PluginRuntimeContext["runtime"];
  readonly config: PluginRuntimeContext["config"];

  constructor(
    pluginId: string,
    host: PluginRuntime,
    capabilities: Set<PluginCapabilityName>
  ) {
    this.runtime = {
      openSession: (options?: PluginSessionOptions) => {
        requireCapability(pluginId, capabilities, "runs");
        return new PluginSessionView(host.openSession(options), pluginId, capabilities);
      },
      listBundles: () => host.listBundles(),
      getBundle: (name: string) => host.getBundle(name)
    };

    this.config = {
      getPaths: () => {
        requireCapability(pluginId, capabilities, "config");
        return host.getConfigPaths();
      }
    };
  }
}

// PluginAgentContextView is the per-run conversation view exposed to hooks and
// input handlers, with capability checks applied at the edge.
export class PluginAgentContextView implements PluginAgentContext {
  readonly runs: PluginAgentContext["runs"];

  constructor(
    private readonly pluginId: string,
    private readonly context: PluginAgentContext,
    private readonly capabilities: Set<PluginCapabilityName>
  ) {
    this.runs = {
      createController: (options) => {
        requireCapability(this.pluginId, this.capabilities, "runs");
        return new PluginControllerView(this.context.runs.createController(options), this.pluginId, this.capabilities);
      }
    };
  }

  getMessages() {
    return this.context.getMessages();
  }

  getSessionEvents() {
    return this.context.getSessionEvents();
  }

  setMessages(messages: Parameters<PluginAgentContext["setMessages"]>[0]) {
    this.context.setMessages(messages);
  }

  overrideSession() {
    this.context.overrideSession();
  }

  overrideSessionEvents(events: Parameters<PluginAgentContext["overrideSessionEvents"]>[0]) {
    this.context.overrideSessionEvents(events);
  }

  getSessionKey() {
    return this.context.getSessionKey();
  }

  getWorkspaceRoot() {
    return this.context.getWorkspaceRoot();
  }

  emit(event: Parameters<PluginAgentContext["emit"]>[0], payload: Parameters<PluginAgentContext["emit"]>[1]) {
    this.context.emit(event, payload);
  }

  getActiveModelId() {
    requireCapability(this.pluginId, this.capabilities, "models");
    return this.context.getActiveModelId();
  }

  getActiveSystemPrompt() {
    return this.context.getActiveSystemPrompt();
  }
}
