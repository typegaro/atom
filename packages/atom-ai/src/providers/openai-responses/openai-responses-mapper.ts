import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { AgentMessage, Message, ThinkingPart } from "../../types/message";
import { MessageRole } from "../../types/message-role";
import type { ModelDefinition } from "../../types/model";
import type { ToolCall, ToolDefinition } from "../../types/tool";
import { normalizeUsage, parseToolArguments } from "../utils";

const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";

export type CodexResponse = {
  id?: string;
  status?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  output?: Array<{
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    summary?: Array<{ text?: string }>;
    content?: Array<{
      type?: string;
      text?: string;
      summary?: Array<{ text?: string }>;
    }>;
  }>;
};

export type CodexOutputItem = NonNullable<CodexResponse["output"]>[number];

export function resolveResponsesBaseUrl(baseUrl?: string): string {
  const raw = baseUrl?.trim() ? baseUrl : DEFAULT_CODEX_BASE_URL;
  const normalized = raw.replace(/\/+$/, "");

  if (normalized.endsWith("/codex/responses")) {
    return normalized.slice(0, -"/responses".length);
  }

  return normalized.endsWith("/codex") ? normalized : `${normalized}/codex`;
}

export function createEmptyMessage(model: ModelDefinition): AgentMessage {
  return {
    role: MessageRole.Assistant,
    api: model.api,
    model: model.id,
    content: [],
    stopReason: "stop"
  };
}

function convertTools(tools?: ToolDefinition[]): Array<Record<string, unknown>> | undefined {
  return tools?.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false
  }));
}

function flattenText(parts: Extract<Message, { role: MessageRole.Assistant | MessageRole.Tool | MessageRole.User }>["content"]): string {
  return parts
    .filter((part): part is { type: ContentPartType.Text; text: string } => part.type === ContentPartType.Text)
    .map((part) => part.text)
    .join("\n");
}

function buildInputItems(message: Message): Record<string, unknown>[] {
  if (message.role === MessageRole.User) {
    const content = message.content
      .map((part) => part.type === ContentPartType.Text
        ? { type: "input_text", text: part.text }
        : { type: "input_image", image_url: `data:${part.mimeType};base64,${part.data}` });
    return content.length > 0 ? [{ role: MessageRole.User, content }] : [];
  }

  if (message.role === MessageRole.Tool) {
    return [{
      type: "function_call_output",
      call_id: message.toolCallId,
      output: flattenText(message.content)
    }];
  }

  const content = message.content
    .filter((part) => part.type === ContentPartType.Text)
    .map((part) => ({ type: "output_text", text: part.text }));

  const items: Record<string, unknown>[] = content.length > 0
    ? [{ role: MessageRole.Assistant, content }]
    : [];

  for (const part of message.content) {
    if (part.type !== ContentPartType.ToolCall) {
      continue;
    }

    items.push({
      type: "function_call",
      call_id: part.id,
      name: part.name,
      arguments: JSON.stringify(part.arguments)
    });
  }

  return items;
}

export function buildRequestBody(model: ModelDefinition, context: Context): ResponseCreateParamsStreaming {
  const input = context.messages.flatMap((message) => buildInputItems(message));

  return {
    model: model.id,
    store: false,
    stream: true,
    instructions: context.system,
    input: input as unknown as ResponseCreateParamsStreaming["input"],
    tools: convertTools(context.tools) as ResponseCreateParamsStreaming["tools"],
    reasoning: { effort: "medium", summary: "auto" },
    tool_choice: context.tools && context.tools.length > 0 ? "auto" : undefined,
    parallel_tool_calls: true
  };
}

export function buildMessageFromResponse(
  model: ModelDefinition,
  response: CodexResponse,
  fallbackText: string,
  fallbackThinking: string
): AgentMessage {
  const content: AgentMessage["content"] = [];
  let sawText = false;
  let sawThinking = false;

  for (const item of response.output ?? []) {
    if (item.type === "reasoning") {
      const summaryText = item.summary
        ?.map((entry) => entry.text)
        .filter((text): text is string => typeof text === "string" && text.length > 0)
        .join("\n");
      if (summaryText) {
        content.push({ type: ContentPartType.Thinking, text: summaryText } satisfies ThinkingPart);
        sawThinking = true;
      }
      continue;
    }

    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string" && part.text.length > 0) {
          content.push({ type: ContentPartType.Text, text: part.text });
          sawText = true;
        }

        const summaryText = part.summary
          ?.map((entry) => entry.text)
          .filter((text): text is string => typeof text === "string" && text.length > 0)
          .join("\n");
        if (summaryText) {
          content.push({ type: ContentPartType.Thinking, text: summaryText } satisfies ThinkingPart);
          sawThinking = true;
        }
      }
    }

    if (item.type === "function_call" && typeof item.call_id === "string" && typeof item.name === "string") {
      content.push({
        type: ContentPartType.ToolCall,
        id: item.call_id,
        name: item.name,
        arguments: parseToolArguments(item.arguments)
      } satisfies ToolCall);
    }
  }

  if (!sawThinking && fallbackThinking) {
    content.unshift({ type: ContentPartType.Thinking, text: fallbackThinking });
  }

  if (!sawText && fallbackText) {
    content.push({ type: ContentPartType.Text, text: fallbackText });
  }

  return {
    role: MessageRole.Assistant,
    api: model.api,
    model: model.id,
    responseId: response.id,
    content,
    usage: normalizeUsage(response.usage),
    stopReason: content.some((part) => part.type === ContentPartType.ToolCall)
      ? "tool-use"
      : (response.status === "incomplete" ? "length" : "stop")
  };
}

export function setOutputItem(output: CodexOutputItem[], index: number, item: CodexOutputItem): void {
  output[index] = item;
}
