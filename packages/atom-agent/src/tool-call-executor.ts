import type { AgentRunEvent, ToolCall } from "atom-ai";
import type { EventStream } from "atom-ai";
import type { AgentRunResult } from "atom-ai";
import { StreamEventSource, StreamEventType } from "atom-ai";
import { AgentHookName, PluginEventName } from "@typegaro/atom-plugin";
import type { PluginManager } from "atom-plugin-runtime";
import type { AgentContext } from "./context";
import type { AgentToolRuntime } from "./tool-runtime";

export interface ToolCallExecutorOptions {
  context: AgentContext;
  pluginManager: PluginManager;
  toolRuntime: AgentToolRuntime;
}

// ToolCallExecutor owns the lifecycle around a tool call: stream events, plugin
// hooks, execution, and adding the result back into conversation state.
export class ToolCallExecutor {
  private readonly context: AgentContext;
  private readonly pluginManager: PluginManager;
  private readonly toolRuntime: AgentToolRuntime;

  constructor(options: ToolCallExecutorOptions) {
    this.context = options.context;
    this.pluginManager = options.pluginManager;
    this.toolRuntime = options.toolRuntime;
  }

  async executeAll(toolCalls: ToolCall[], runStream: EventStream<AgentRunEvent, AgentRunResult>): Promise<void> {
    for (const toolCall of toolCalls) {
      await this.execute(toolCall, runStream);
    }
  }

  async execute(toolCall: ToolCall, runStream: EventStream<AgentRunEvent, AgentRunResult>): Promise<void> {
    this.push(runStream, { source: StreamEventSource.Tool, type: StreamEventType.ToolRunStart, toolCall });
    await this.pluginManager.emit(PluginEventName.ToolRunStart, { toolCall });
    await this.pluginManager.dispatchHook(AgentHookName.BeforeToolCall, this.context, toolCall);

    const toolResult = await this.toolRuntime.runTool(toolCall);
    this.context.addToolResult(toolResult);

    this.push(runStream, { source: StreamEventSource.Tool, type: StreamEventType.ToolRunEnd, toolCall, result: toolResult });
    await this.pluginManager.dispatchHook(AgentHookName.AfterToolCall, this.context, toolCall, toolResult);
    await this.pluginManager.emit(PluginEventName.ToolRunEnd, { toolCall, result: toolResult });
  }

  private push(runStream: EventStream<AgentRunEvent, AgentRunResult>, event: AgentRunEvent): void {
    runStream.push(event);
  }
}
