import type { Context, Usage } from "atom-ai";
import { MessageRole } from "atom-ai";
import type { AgentMessage, Message, UserMessage, UserMessagePart } from "atom-ai";
import type { ToolDefinition, ToolResultMessage } from "atom-ai";
import type { PluginControllerFor, PluginControllerOptions, PluginRunsCapability, PluginRuntimeEventDefinition } from "@typegaro/atom-plugin";
import type { PromptShard } from "atom-bundle";
import type { RuntimeEvent } from "@typegaro/atom-types";
import { SessionWriter } from "./session-writer";
import type { SessionEvent, SessionSummary } from "./session-writer";

export type { SessionEvent, SessionSummary };

export interface AgentContextSnapshot {
  messages: Message[];
}

export interface AgentContextOptions {
  systemPrompt?: string;
  systemPromptShards?: PromptShard[];
  messages?: Message[];
  tools?: ToolDefinition[];
  cwd?: string;
  workspaceRoot?: string;
  storeSession?: boolean;
  modelId?: string;
  sessionKey?: string;
  createController?: PluginRunsCapability<"models" | "sessions">["createController"];
}

// AgentContext is the durable state container for a conversation.
//
// It keeps the provider-facing transcript, the currently exposed tool set, and
// the lightweight session writer in sync. The agent loop mutates this object,
// while plugins and providers read from snapshots derived from it.
export class AgentContext {
  private systemPrompt?: string;
  private systemPromptShards: PromptShard[];
  private readonly messages: Message[];
  private tools: ToolDefinition[];
  private readonly cwd: string;
  private readonly workspaceRoot: string;
  private readonly modelId?: string;
  private readonly sessionKey: string | undefined;
  private readonly controllerFactory?: PluginRunsCapability<"models" | "sessions">["createController"];
  private readonly session: SessionWriter | null;
  private readonly runtimeEvents: RuntimeEvent[] = [];
  // Tracks the latest API response usage, which reflects the current context size
  // since each call sends the full conversation history.
  private latestUsage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  constructor(options: AgentContextOptions = {}) {
    this.systemPrompt = options.systemPrompt;
    this.systemPromptShards = [...(options.systemPromptShards ?? [])];
    this.messages = [...(options.messages ?? [])];
    this.tools = [...(options.tools ?? [])];
    this.cwd = options.cwd ?? process.cwd();
    this.workspaceRoot = options.workspaceRoot ?? this.cwd;
    this.modelId = options.modelId;
    this.sessionKey = options.sessionKey;
    this.controllerFactory = options.createController;
    this.session = options.storeSession !== false
      ? new SessionWriter({ cwd: this.cwd, workspaceRoot: this.workspaceRoot })
      : null;
  }

  setSystemPrompt(prompt?: string): void {
    this.systemPrompt = prompt;
    this.systemPromptShards = prompt ? [{ source: "system", content: prompt }] : [];
  }

  setSystemPromptShards(shards: PromptShard[]): void {
    this.systemPromptShards = shards.map((shard) => ({ ...shard }));
    this.systemPrompt = shards.map((shard) => shard.content).join("\n\n");
  }

  setTools(tools: ToolDefinition[]): void {
    this.tools = [...tools];
  }

  appendTools(tools: ToolDefinition[]): void {
    this.tools = [...this.tools, ...tools];
  }

  addUserMessage(input: UserMessagePart[]): UserMessage {
    const message: UserMessage = { role: MessageRole.User, content: [...input] };
    this.messages.push(message);
    this.session?.bufferMessage(message);
    return message;
  }

  addAssistantMessage(message: AgentMessage): void {
    this.messages.push(message);

    if (message.usage) {
      // Each API call sends the full conversation history, so the returned usage
      // already reflects the current context size — overwrite, don't accumulate.
      this.latestUsage.inputTokens = message.usage.inputTokens;
      this.latestUsage.outputTokens = message.usage.outputTokens;
      this.latestUsage.totalTokens = message.usage.totalTokens;

      if (message.usage.cost) {
        this.latestUsage.cost = { ...message.usage.cost };
      }
    }

    this.session?.bufferMessage(message);
  }

  addToolResult(message: ToolResultMessage): void {
    this.messages.push(message);
    this.session?.bufferMessage(message);
  }

  resetMessages(): void {
    this.messages.length = 0;
  }

  setMessages(messages: Message[]): void {
    this.messages.length = 0;
    this.messages.push(...messages);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getSessionEvents(): SessionEvent[] {
    return this.session?.getEvents() ?? [];
  }

  /** Returns the usage from the most recent API response, reflecting current context size. */
  getTotalUsage(): Usage {
    return { ...this.latestUsage, cost: this.latestUsage.cost ? { ...this.latestUsage.cost } : undefined };
  }

  flushTurn(): void {
    this.session?.flushTurn();
  }

  overrideSession(): void {
    this.session?.override(this.messages);
  }

  overrideSessionEvents(events: SessionEvent[]): void {
    this.session?.overrideEvents(events);
  }

  recordModelChange(modelId: string): void {
    this.session?.recordModelChange(modelId);
  }

  recordInterrupt(): void {
    this.session?.recordInterrupt();
  }

  getSessionId(): string | undefined {
    return this.session?.getSessionId();
  }

  getSessionFilePath(): string | undefined {
    return this.session?.getSessionFilePath();
  }

  restoreFromSnapshot(snapshot: AgentContextSnapshot, sessionFilePath?: string, sessionId?: string): void {
    this.messages.length = 0;
    this.messages.push(...snapshot.messages.map((m) => ({ ...m })));

    if (sessionFilePath && sessionId) {
      this.session?.restore(sessionFilePath, sessionId);
    } else {
      this.session?.reset();
    }
  }

  getActiveSystemPrompt(): string | undefined {
    return this.systemPrompt;
  }

  getActiveSystemPromptShards(): PromptShard[] {
    return this.systemPromptShards.map((shard) => ({ ...shard }));
  }

  getActiveModelId(): string | undefined {
    return this.modelId;
  }

  get runs() {
    return { createController: this.createController.bind(this) };
  }

  // Plugin-created controllers inherit the same workspace and session scope,
  // but only when the embedding app explicitly exposes that capability.
  createController(options: PluginControllerOptions = {}): PluginControllerFor<"models" | "sessions"> {
    if (!this.controllerFactory) {
      throw new Error("Plugin controller creation is not available in this context");
    }

    return this.controllerFactory(options);
  }

  getSessionKey(): string | undefined {
    return this.sessionKey;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  emit(event: PluginRuntimeEventDefinition, payload: Record<string, unknown> = {}): void {
    const runtimeEvent = { ...payload, type: event.type } as RuntimeEvent;
    this.runtimeEvents.push(runtimeEvent);

    if (event.replay) {
      this.session?.bufferRuntimeEvent(runtimeEvent);
    }
  }

  /** Push a raw runtime event. Used by the tool runtime so plugin tools can emit events. */
  pushRuntimeEvent(event: RuntimeEvent): void {
    this.runtimeEvents.push(event);
  }

  drainRuntimeEvents(): RuntimeEvent[] {
    return this.runtimeEvents.splice(0);
  }

  // Providers always receive the full conversation because the current runtime
  // does not try to trim or summarize history automatically.
  toProviderContext(): Context {
    return {
      system: this.systemPrompt,
      messages: this.getMessages(),
      tools: this.tools.length > 0 ? [...this.tools] : undefined
    };
  }
}
