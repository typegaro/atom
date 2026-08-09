import type { AgentRuntime, Usage } from "atom-ai";
import { ContentPartType, EventStream } from "atom-ai";
import type { AgentMessage, Message, UserMessagePart } from "atom-ai";
import type { ToolCall, ToolDefinition } from "atom-ai";
import type { AgentRunEvent, AgentRunResult, AgentRunStream } from "atom-ai";
import { StreamEventSource, StreamEventType } from "atom-ai";
import type { PluginRunsCapability } from "@typegaro/atom-plugin";
import type { AgentBundle, Skill, PromptShard } from "atom-bundle";
import { DEFAULT_SYSTEM_PROMPT, buildSystemPromptShards } from "atom-bundle";
import type { McpManager } from "atom-mcp";
import { RemoteMcpManager } from "atom-mcp";
import { AgentHookName, type InputEvent } from "@typegaro/atom-plugin";
import { PluginEventName } from "@typegaro/atom-plugin";
import type { RuntimeEvent } from "@typegaro/atom-types";
import { AgentContext, type AgentContextSnapshot } from "./context";
import { AgentToolRuntime } from "./tool-runtime";
import { ToolCallExecutor } from "./tool-call-executor";
import { PluginManager } from "atom-plugin-runtime";

// AtomAgent owns the main run loop.
//
// Each turn rebuilds the system prompt from workspace instructions and plugin
// fragments, sends the full conversation to the provider, and then resolves
// any tool calls before asking the model to continue. The context object keeps
// the durable conversation state while this class coordinates transient work
// like streaming, interrupts, hooks, and file change notifications.
//
// The agent receives a fully resolved AgentBundle — it never performs discovery
// or loading itself. See AgentBundleManager for the orchestration side.

export interface AtomAgentOptions {
  runtime: AgentRuntime;
  /** Pre-assembled bundle containing tools, skills, prompt shards, and managers. */
  bundle: AgentBundle;
  systemPrompt?: string;
  cwd?: string;
  storeSession?: boolean;
  sessionKey?: string;
  createController?: PluginRunsCapability<"models" | "sessions">["createController"];
}

// AtomAgent presents a simple chat-like surface over the full runtime: model,
// plugins, MCP tools, session storage, and streaming events.
export class AtomAgent {
  private readonly runtime: AgentRuntime;
  private readonly baseSystemPrompt: string;
  private readonly workspaceInstructions: string[];
  private readonly context: AgentContext;
  private readonly skills: Skill[];
  private readonly pluginManager: PluginManager;
  private readonly mcpManager: McpManager;
  private readonly toolRuntime: AgentToolRuntime;
  private readonly toolExecutor: ToolCallExecutor;
  private dynamicToolsEnabled = true;
  private currentAbortController?: AbortController;
  private forwardedRunError?: string;

  constructor(options: AtomAgentOptions) {
    const workspaceRoot = process.env.ATOM_WORKSPACE_ROOT ?? options.cwd ?? process.cwd();
    const { bundle } = options;

    this.runtime = options.runtime;
    this.baseSystemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    // Everything else comes from the pre-assembled bundle
    this.workspaceInstructions = bundle.workspaceInstructions;
    this.skills = bundle.skills;
    this.pluginManager = bundle.pluginManager;
    this.mcpManager = bundle.mcpManager ?? new RemoteMcpManager(workspaceRoot);
    this.context = new AgentContext({
      systemPrompt: this.baseSystemPrompt,
      tools: bundle.tools,
      systemPromptShards: bundle.promptShards,
      cwd: options.cwd,
      workspaceRoot,
      storeSession: options.storeSession,
      modelId: this.runtime.model.id,
      sessionKey: options.sessionKey,
      createController: options.createController
    });
    this.toolRuntime = new AgentToolRuntime({
      workspaceRoot,
      pluginManager: this.pluginManager,
      mcpManager: this.mcpManager,
      skills: this.skills,
      sessionKey: options.sessionKey,
      emitRuntimeEvent: (event) => this.context.pushRuntimeEvent(event)
    });
    this.toolExecutor = new ToolCallExecutor({
      context: this.context,
      pluginManager: this.pluginManager,
      toolRuntime: this.toolRuntime
    });
  }

  clearTools(): void {
    this.dynamicToolsEnabled = false;
    this.context.setTools([]);
  }

  // Starts a run immediately and returns a stream of agent and tool events.
  // The caller can consume the stream incrementally or await `result()`.
  run(input: UserMessagePart[]): AgentRunStream {
    const runStream = new EventStream<AgentRunEvent, AgentRunResult>();
    void this.executeRun(input, runStream);
    return runStream;
  }

  // Convenience wrapper around `run()` for callers that only need the final
  // assistant message and do not care about intermediate events.
  async send(input: UserMessagePart[]): Promise<AgentMessage> {
    const result = await this.run(input).result();
    return result.message;
  }

  history(): Message[] {
    return this.context.getMessages();
  }

  interrupt(): void {
    this.currentAbortController?.abort();
  }

  recordModelChange(modelId: string): void {
    this.context.recordModelChange(modelId);
  }

  recordInterrupt(): void {
    this.context.recordInterrupt();
  }

  getActiveSystemPrompt(): string | undefined {
    return this.context.getActiveSystemPrompt();
  }

  getActiveSystemPromptShards(): PromptShard[] {
    const shards = this.context.getActiveSystemPromptShards();
    return shards.length > 0 ? shards : this.refreshSystemPrompt();
  }

  /** Whether the active model can accept image input. */
  supportsImages(): boolean {
    return this.runtime.model.capabilities.images;
  }

  getSessionId(): string | undefined {
    return this.context.getSessionId();
  }

  getSessionFilePath(): string | undefined {
    return this.context.getSessionFilePath();
  }

  restoreFromSnapshot(snapshot: AgentContextSnapshot, sessionFilePath?: string, sessionId?: string): void {
    this.context.restoreFromSnapshot(snapshot, sessionFilePath, sessionId);
  }

  getTotalUsage(): Usage {
    return this.context.getTotalUsage();
  }

  // Routes plugin-defined input events through the plugin manager and returns
  // any runtime events the handlers emitted back into the app layer.
  async handleInputEvent(event: InputEvent): Promise<RuntimeEvent[]> {
    const handled = await this.pluginManager.handleInput(this.context, event);

    if (!handled) {
      throw new Error(`Unhandled input event: ${event.type}`);
    }

    return this.drainRuntimeEvents();
  }

  drainRuntimeEvents(): RuntimeEvent[] {
    return this.context.drainRuntimeEvents();
  }

  private async executeRun(input: UserMessagePart[], runStream: EventStream<AgentRunEvent, AgentRunResult>): Promise<void> {
    const inputText = summarizeUserInput(input);
    runStream.push({ source: StreamEventSource.Agent, type: StreamEventType.RunStart, input: inputText });

    try {
      await this.pluginManager.dispatchHook(AgentHookName.BeforeRun, this.context, input);
      this.context.addUserMessage(input);
      await this.pluginManager.emit(PluginEventName.RunStart, { input: inputText });
      this.currentAbortController = new AbortController();

      while (true) {
        const response = await this.runModelTurn(runStream);

        const toolCalls = response.content.filter((part): part is ToolCall => part.type === ContentPartType.ToolCall);
        if (toolCalls.length === 0) {
          await this.finishRun(response, runStream);
          return;
        }

        await this.toolExecutor.executeAll(toolCalls, runStream);
      }
    } catch (error) {
      this.failRun(error, runStream);
    } finally {
      this.currentAbortController = undefined;
      this.forwardedRunError = undefined;
    }
  }

  private async runModelTurn(runStream: EventStream<AgentRunEvent, AgentRunResult>): Promise<AgentMessage> {
    this.refreshSystemPrompt();

    await this.pluginManager.dispatchHook(AgentHookName.BeforeModelCall, this.context);

    const providerStream = this.runtime.providerRuntime.stream(this.context.toProviderContext(), this.currentAbortController?.signal);

    for await (const event of providerStream) {
      runStream.push(event);
      if (event.type === StreamEventType.Error) {
        this.forwardedRunError = event.error;
      }
      if (event.type === StreamEventType.MessageStart) {
        await this.pluginManager.emit(PluginEventName.MessageStart, { message: event.message });
      } else if (event.type === StreamEventType.MessageEnd) {
        await this.pluginManager.emit(PluginEventName.MessageEnd, { message: event.message });
      }
    }

    const response = await providerStream.result();
    this.context.addAssistantMessage(response);
    await this.pluginManager.dispatchHook(AgentHookName.AfterModelCall, this.context, response);
    return response;
  }

  private refreshSystemPrompt(): PromptShard[] {
    const shards = buildSystemPromptShards(
      this.baseSystemPrompt,
      this.workspaceInstructions,
      this.pluginManager.getAgentPromptShards(),
      this.skills
    );
    this.context.setSystemPromptShards(shards);
    return shards;
  }

  private async finishRun(response: AgentMessage, runStream: EventStream<AgentRunEvent, AgentRunResult>): Promise<void> {
    const result = { message: response, history: this.context.getMessages() };
    this.context.flushTurn();
    await this.pluginManager.dispatchHook(AgentHookName.AfterRun, this.context, result);
    runStream.push({ source: StreamEventSource.Agent, type: StreamEventType.RunEnd, result });
    runStream.end(result);
    await this.pluginManager.emit(PluginEventName.RunEnd, { result });
  }

  private failRun(error: unknown, runStream: EventStream<AgentRunEvent, AgentRunResult>): void {
    this.context.flushTurn();

    if (error instanceof Error && error.name === "AbortError") {
      runStream.push({ source: StreamEventSource.Agent, type: StreamEventType.Interrupted });
      runStream.fail(error);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message !== this.forwardedRunError) {
      runStream.push({ source: StreamEventSource.Agent, type: StreamEventType.Error, error: message });
    }
    runStream.fail(error);
  }
}

function summarizeUserInput(input: UserMessagePart[]): string {
  return input
    .map((part) => part.type === ContentPartType.Text ? part.text : `[image:${part.mimeType}]`)
    .filter(Boolean)
    .join("\n");
}
