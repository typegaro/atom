import { ApiId } from "./api";

// These are the canonical conversation types shared across the runtime, app,
// and public plugin SDK. The goal is to keep the transcript model small and
// provider-agnostic so higher layers can compose on top of one message shape.

export enum ContentPartType {
  Text = "text",
  Image = "image",
  Thinking = "thinking",
  ToolCall = "tool-call"
}

export enum MessageRole {
  User = "user",
  Assistant = "assistant",
  Tool = "tool"
}

export interface UsageCost {
  input: number;
  output: number;
  total: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: UsageCost;
}

export type JsonSchema = Record<string, unknown>;

// ToolDefinition describes a callable tool as the model sees it: name,
// description, and JSON-schema-like input contract.
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface ToolCall {
  type: ContentPartType.ToolCall;
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultPart {
  type: ContentPartType.Text;
  text: string;
}

export interface ToolResultMessage {
  role: MessageRole.Tool;
  toolCallId: string;
  toolName: string;
  content: ToolResultPart[];
  isError: boolean;
}

export interface TextPart {
  type: ContentPartType.Text;
  text: string;
}

export interface ImagePart {
  type: ContentPartType.Image;
  mimeType: string;
  data: string;
}

export interface ThinkingPart {
  type: ContentPartType.Thinking;
  text: string;
}

export type UserMessagePart = TextPart | ImagePart;
export type AgentMessagePart = TextPart | ThinkingPart | ToolCall;

export interface UserMessage {
  role: MessageRole.User;
  content: UserMessagePart[];
}

// AgentMessage is the normalized assistant turn produced by any provider. Text,
// reasoning, and tool calls all live in `content` so providers with different
// wire formats can still converge on one internal representation.
export interface AgentMessage {
  role: MessageRole.Assistant;
  api: ApiId;
  model: string;
  content: AgentMessagePart[];
  stopReason: "stop" | "length" | "tool-use" | "error" | "aborted";
  usage?: Usage;
  errorMessage?: string;
  responseId?: string;
}

export type Message = UserMessage | AgentMessage | ToolResultMessage;

export interface AgentRunResult {
  message: AgentMessage;
  history: Message[];
}
