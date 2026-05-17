import { ApiId } from "./api";
export declare enum ContentPartType {
    Text = "text",
    Image = "image",
    Thinking = "thinking",
    ToolCall = "tool-call"
}
export declare enum MessageRole {
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
