import type { AgentMessage, Message } from "./message";
import type { ToolCall } from "./tool";
import type { ToolResultMessage } from "./tool";
import type { Usage } from "./usage";
import type { AgentRunResult } from "@typegaro/atom-types";
export type { AgentRunResult } from "@typegaro/atom-types";

export enum StreamEventSource {
  Provider = "provider",
  Agent = "agent",
  Tool = "tool"
}

export enum StreamEventType {
  MessageStart = "message-start",
  TextDelta = "text-delta",
  ThinkingDelta = "thinking-delta",
  ToolCallDelta = "tool-call-delta",
  ToolCall = "tool-call",
  Usage = "usage",
  MessageEnd = "message-end",
  RunStart = "run-start",
  ToolRunStart = "tool-run-start",
  ToolRunEnd = "tool-run-end",
  Interrupted = "interrupted",
  RunEnd = "run-end",
  Error = "error"
}

export type Stream<TEvent, TResult> = AsyncIterable<TEvent> & {
  result(): Promise<TResult>;
};

export type ProviderEvent =
  | { source: StreamEventSource.Provider; type: StreamEventType.MessageStart; message: AgentMessage }
  | { source: StreamEventSource.Provider; type: StreamEventType.TextDelta; contentIndex: number; delta: string }
  | { source: StreamEventSource.Provider; type: StreamEventType.ThinkingDelta; contentIndex: number; delta: string }
  | { source: StreamEventSource.Provider; type: StreamEventType.ToolCallDelta; toolCall: ToolCall; delta: string }
  | { source: StreamEventSource.Provider; type: StreamEventType.ToolCall; toolCall: ToolCall }
  | { source: StreamEventSource.Provider; type: StreamEventType.Usage; usage: Usage }
  | { source: StreamEventSource.Provider; type: StreamEventType.MessageEnd; message: AgentMessage }
  | { source: StreamEventSource.Provider; type: StreamEventType.Error; error: string };

export type AgentRunEvent =
  | { source: StreamEventSource.Agent; type: StreamEventType.RunStart; input: string }
  | ProviderEvent
  | { source: StreamEventSource.Tool; type: StreamEventType.ToolRunStart; toolCall: ToolCall }
  | { source: StreamEventSource.Tool; type: StreamEventType.ToolRunEnd; toolCall: ToolCall; result: ToolResultMessage }
  | { source: StreamEventSource.Agent; type: StreamEventType.Interrupted }
  | { source: StreamEventSource.Agent; type: StreamEventType.RunEnd; result: AgentRunResult }
  | {
    source: StreamEventSource.Agent | StreamEventSource.Tool | StreamEventSource.Provider;
    type: StreamEventType.Error;
    error: string;
  };

export type ProviderStream = Stream<ProviderEvent, AgentMessage>;
export type AgentRunStream = Stream<AgentRunEvent, AgentRunResult>;
