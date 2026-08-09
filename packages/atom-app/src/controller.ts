import type { AtomAgent, PromptShard } from "atom-agent";
import { RuntimeEventType, SessionEventType, type InputEvent } from "@typegaro/atom-types";
import type { AvailableModelSettings } from "atom-ai";
import { getConfigPaths } from "@typegaro/atom-types";
import type { PluginControllerFor } from "@typegaro/atom-plugin";
import { runAgent } from "./run-agent";
import { deleteSessionFile, listSessions, loadSessionEvents, type SessionEvent, type SessionSummary } from "./session-store";
import { isInputEvent, normalizeAppUserInput, type AppSendResult, type AppUserInput } from "./types";
import type { RuntimeEvent } from "@typegaro/atom-types";
import type { AtomAppRuntime } from "./app-runtime";

export interface AtomAppControllerOptions {
  modelId?: string;
  provider?: string;
  includeMcp?: boolean;
  cwd?: string;
  storeSession?: boolean;
  sessionKey?: string;
  bundleName?: string;
}

interface AgentSnapshot {
  messages: ReturnType<AtomAgent["history"]>;
  sessionFilePath?: string;
  sessionId?: string;
}

// AtomAppController is the app-facing orchestration layer.
//
// AtomAppRuntime owns the long-lived runtime services. This controller owns one
// conversation's mutable state on top of that shared runtime: selected model,
// active agent instance, transcript restoration, and app-facing run methods.
export class AtomAppController implements PluginControllerFor<"models" | "sessions"> {
  private readonly runtime: AtomAppRuntime;
  private readonly storeSession: boolean;
  private readonly sessionKey: string | undefined;
  private readonly bundleName: string | undefined;
  private activeProviderName: string | undefined;
  private activeModelId: string | undefined;
  private models: AvailableModelSettings[] = [];
  private agent: AtomAgent | undefined;

  constructor(runtime: AtomAppRuntime, options: AtomAppControllerOptions = {}) {
    this.runtime = runtime;
    this.activeProviderName = options.provider;
    this.activeModelId = options.modelId;
    this.sessionKey = options.sessionKey;
    this.storeSession = options.storeSession !== false;
    this.bundleName = options.bundleName;

    // If no explicit model, use the bundle's default model
    if (!this.activeModelId) {
      const bundleDefault = runtime.bundleManager.getDefaultModel();
      if (bundleDefault) {
        this.activeModelId = bundleDefault;
      }
    }
  }

  // Preloads plugins and MCP servers so the first user turn does not pay that
  // startup cost, and so tool lists are available before the agent is created.
  async initialize(): Promise<void> {
    await this.runtime.bundleManager.loadIfNeeded();
    this.models = await this.listModelsFromRegistry();

    if (!this.activeProviderName || !this.activeModelId) {
      const firstModel = this.models[0];
      this.activeProviderName ??= firstModel?.provider;
      this.activeModelId ??= firstModel?.id;
    }

    if (this.activeProviderName && this.activeModelId && !this.agent) {
      this.agent = await this.createAgent();
      this.recordActiveModelChange(this.agent);
    }
  }

  getActiveModelId(): string | undefined {
    return this.activeModelId;
  }

  supportsImages(): boolean {
    return this.agent?.supportsImages() ?? false;
  }

  getActiveBundleName(): string | undefined {
    return this.bundleName;
  }

  getActiveSystemPrompt(): string | undefined {
    return this.agent?.getActiveSystemPrompt();
  }

  getActiveSystemPromptShards(): PromptShard[] {
    return this.agent?.getActiveSystemPromptShards() ?? [];
  }

  getTotalUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
    return this.agent?.getTotalUsage() ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  listModels(): AvailableModelSettings[] {
    return this.models;
  }

  async resetConversation(): Promise<void> {
    this.agent = await this.createAgent();
    this.recordActiveModelChange(this.agent);
  }

  resetSession(): Promise<void> {
    return this.resetConversation();
  }

  interrupt(): void {
    this.agent?.interrupt();
  }

  // Switching models preserves the transcript and session metadata by snapshotting
  // the current agent, rebuilding it with a new runtime, then restoring state.
  async switchModel(modelId: string): Promise<void> {
    const selectedModel = this.listModels().find((model) => model.id === modelId);

    if (!selectedModel) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const snapshot = this.captureAgentSnapshot();

    this.activeProviderName = selectedModel.provider;
    this.activeModelId = selectedModel.id;
    this.agent = await this.createAgent();
    this.restoreAgentSnapshot(this.agent, snapshot);
    this.recordActiveModelChange(this.agent);
  }

  listSessions(): SessionSummary[] {
    return listSessions(this.runtime.cwd);
  }

  loadSession(sessionId: string): SessionEvent[] {
    const sessions = listSessions(this.runtime.cwd);
    const session = sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      return [];
    }

    const events = loadSessionEvents(session.filePath);
    const snapshot = {
      messages: events
      .filter((e): e is Extract<SessionEvent, { type: SessionEventType.Message }> => e.type === SessionEventType.Message)
      .map((e) => e.message),
      sessionFilePath: session.filePath,
      sessionId: session.id
    } satisfies AgentSnapshot;

    if (snapshot.messages.length > 0 && this.agent) {
      this.restoreAgentSnapshot(this.agent, snapshot);
    }
    return events;
  }

  deleteSession(sessionId: string): boolean {
    const sessions = listSessions(this.runtime.cwd);
    const session = sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      return false;
    }

    if (this.agent?.getSessionId() === sessionId) {
      this.restoreAgentSnapshot(this.agent, {
        messages: this.agent.history()
      });
    }

    return deleteSessionFile(session.filePath);
  }

  // `submit()` is the streaming entrypoint used by TUI and plugin runtimes.
  // It normalizes both conversational input and plugin-defined input events.
  async *submit(input: AppUserInput): AsyncGenerator<RuntimeEvent> {
    if (isInputEvent(input)) {
      yield* this.handlePluginInput(input);
      return;
    }

    let agent: AtomAgent;
    const normalizedInput = normalizeAppUserInput(input);

    try {
      agent = await this.ensureAgent();
    } catch (error) {
      yield {
        type: RuntimeEventType.Error,
        error: error instanceof Error ? error.message : String(error)
      };
      return;
    }

    const captured: RuntimeEvent[] = [];

    for await (const event of runAgent(agent, normalizedInput)) {
      if (event.type === RuntimeEventType.Interrupted) {
        if (this.storeSession) {
          agent.recordInterrupt();
        }
      }

      yield event;
      captured.push(event);
    }

    // After the run completes, forward reload events to the runtime
    await this.runtime.handleRuntimeEvents(captured);
  }

  async send(input: AppUserInput): Promise<AppSendResult> {
    const result: AppSendResult = { thinkingText: "", assistantText: "" };

    for await (const event of this.submit(input)) {
      this.applySendEvent(result, event);
    }

    return result;
  }

  createController(options: AtomAppControllerOptions = {}): AtomAppController {
    return this.runtime.createController({
      modelId: options.modelId ?? this.activeModelId,
      provider: options.provider ?? this.activeProviderName,
      includeMcp: options.includeMcp ?? Boolean(this.runtime.bundleManager.mcpManager),
      cwd: options.cwd ?? this.runtime.cwd,
      storeSession: options.storeSession ?? this.storeSession,
      sessionKey: options.sessionKey ?? this.sessionKey,
      bundleName: options.bundleName ?? this.bundleName
    });
  }

  private async createAgent(): Promise<AtomAgent> {
    if (!this.activeProviderName || !this.activeModelId) {
      throw new Error("Provider and model are required to create an agent");
    }

    const { AtomAgent } = await import("atom-agent");
    const runtime = await this.runtime.bundleManager.createAgentRuntime({
      model: this.activeModelId,
      provider: this.activeProviderName
    });
    const bundle = await this.runtime.bundleManager.getBundle(this.bundleName);

    return new AtomAgent({
      runtime,
      bundle,
      storeSession: this.storeSession,
      sessionKey: this.sessionKey,
      createController: this.createController.bind(this)
    });
  }

  private async ensureAgent(): Promise<AtomAgent> {
    if (!this.activeProviderName || !this.activeModelId) {
      throw new Error(`No model configured. Add a provider to ${getConfigPaths(this.runtime.cwd).settings} or run atom login.`);
    }

    if (!this.agent) {
      this.agent = await this.createAgent();
    }

    return this.agent;
  }

  private async listModelsFromRegistry(): Promise<AvailableModelSettings[]> {
    await this.runtime.bundleManager.loadIfNeeded();
    return this.runtime.bundleManager.providerRegistry.listModels();
  }

  private recordActiveModelChange(agent: AtomAgent): void {
    if (this.storeSession && this.activeModelId) {
      agent.recordModelChange(this.activeModelId);
    }
  }

  private captureAgentSnapshot(): AgentSnapshot {
    return {
      messages: this.agent?.history() ?? [],
      sessionFilePath: this.agent?.getSessionFilePath(),
      sessionId: this.agent?.getSessionId()
    };
  }

  private restoreAgentSnapshot(agent: AtomAgent, snapshot: AgentSnapshot): void {
    agent.restoreFromSnapshot(
      { messages: snapshot.messages },
      snapshot.sessionFilePath,
      snapshot.sessionId
    );
  }

  private async *handlePluginInput(event: InputEvent): AsyncGenerator<RuntimeEvent> {
    let runtimeEvents: RuntimeEvent[];

    try {
      runtimeEvents = await (await this.ensureAgent()).handleInputEvent(event);
    } catch (error) {
      yield {
        type: RuntimeEventType.Error,
        error: error instanceof Error ? error.message : String(error)
      };
      return;
    }

    for (const runtimeEvent of runtimeEvents) {
      yield runtimeEvent;
    }

    yield { type: RuntimeEventType.Done };
  }

  private applySendEvent(result: AppSendResult, event: RuntimeEvent): void {
    switch (event.type) {
      case RuntimeEventType.TextDelta:
        result.assistantText += event.delta;
        break;
      case RuntimeEventType.ThinkingDelta:
        result.thinkingText += event.delta;
        break;
      case RuntimeEventType.Error:
        result.assistantText = `Error: ${event.error}`;
        break;
      default:
        break;
    }
  }
}
