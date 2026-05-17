import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { AgentMessage, ImagePart, TextPart, ThinkingPart, UserMessagePart } from "../../types/message";
import { MessageRole } from "../../types/message-role";
import type { ModelDefinition } from "../../types/model";
import type { ProviderOptions, Translator } from "../base/provider";
import { StreamEventSource, StreamEventType, type ProviderEvent } from "../../types/stream";
import type { ToolCall, ToolDefinition } from "../../types/tool";
import type { Usage } from "../../types/usage";
import { mapStopReason, normalizeUsage, parseToolArguments } from "../utils";

export interface OpenAICompatibleToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAICompatibleMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | Array<
    | { type: ContentPartType.Text; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAICompatibleToolCall[];
  reasoning_content?: string;
}

export interface OpenAICompatibleResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: OpenAICompatibleToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface OpenAICompatibleChunk {
  id?: string;
  choices?: Array<{
    index?: number;
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function toUserContent(parts: UserMessagePart[]): OpenAICompatibleMessage["content"] {
  const text = parts
    .filter((part): part is TextPart => part.type === ContentPartType.Text)
    .map((part) => part.text)
    .join("\n");
  const images = parts.filter((part): part is ImagePart => part.type === ContentPartType.Image);

  if (images.length === 0) {
    return text;
  }

  return [
    ...(text ? [{ type: ContentPartType.Text, text } as const] : []),
    ...images.map((part) => ({
      type: "image_url" as const,
      image_url: { url: `data:${part.mimeType};base64,${part.data}` }
    }))
  ];
}

export interface OpenAICompatibleRequest {
  model: string;
  messages: OpenAICompatibleMessage[];
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
}

type ToolCallBuffer = {
  id: string;
  name: string;
  argumentsText: string;
};

// Streaming OpenAI-compatible APIs deliver tool calls and text as small deltas.
// We buffer those pieces here so the rest of the provider stack can work with a
// normal `AgentMessage` once the stream completes.
export class OpenAICompatibleStreamState {
  private readonly model: ModelDefinition;
  private responseId?: string;
  private text = "";
  private thinking = "";
  private usage?: Usage;
  private stopReason: AgentMessage["stopReason"] = "stop";
  private readonly toolCalls = new Map<number, ToolCallBuffer>();

  constructor(model: ModelDefinition) {
    this.model = model;
  }

  applyChunk(chunk: OpenAICompatibleChunk): ProviderEvent[] {
    const events: ProviderEvent[] = [];
    this.responseId ??= chunk.id;

    if (chunk.usage) {
      this.usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        totalTokens: chunk.usage.total_tokens ?? 0
      };
      events.push({ source: StreamEventSource.Provider, type: StreamEventType.Usage, usage: this.usage });
    }

    for (const choice of chunk.choices ?? []) {
      if (choice.finish_reason) {
        this.stopReason = this.toStopReason(choice.finish_reason);
      }

      const delta = choice.delta;
      if (!delta) {
        continue;
      }

      if (delta.content) {
        this.text += delta.content;
        events.push({ source: StreamEventSource.Provider, type: StreamEventType.TextDelta, contentIndex: 0, delta: delta.content });
      }

      const thinkingDelta = delta.reasoning ?? delta.reasoning_content;
      if (thinkingDelta) {
        this.thinking += thinkingDelta;
        events.push({ source: StreamEventSource.Provider, type: StreamEventType.ThinkingDelta, contentIndex: 0, delta: thinkingDelta });
      }

      for (const toolDelta of delta.tool_calls ?? []) {
        const index = toolDelta.index ?? 0;
        const current = this.toolCalls.get(index) ?? {
          id: toolDelta.id ?? `${index}`,
          name: toolDelta.function?.name ?? "tool",
          argumentsText: ""
        };

        if (toolDelta.id) {
          current.id = toolDelta.id;
        }

        if (toolDelta.function?.name) {
          current.name = toolDelta.function.name;
        }

        if (toolDelta.function?.arguments) {
          current.argumentsText += toolDelta.function.arguments;
          events.push({
            source: StreamEventSource.Provider,
            type: StreamEventType.ToolCallDelta,
            toolCall: this.toToolCall(current),
            delta: toolDelta.function.arguments
          });
        }

        this.toolCalls.set(index, current);
      }
    }

    return events;
  }

  finalize(): AgentMessage {
    const toolCalls = Array.from(this.toolCalls.values()).map((toolCall) => this.toToolCall(toolCall));

    return {
      role: MessageRole.Assistant,
      api: this.model.api,
      model: this.model.id,
      responseId: this.responseId,
      content: [
        ...(this.thinking ? [{ type: ContentPartType.Thinking, text: this.thinking } as const] : []),
        ...(this.text ? [{ type: ContentPartType.Text, text: this.text } as const] : []),
        ...toolCalls
      ],
      stopReason: this.stopReason,
      usage: this.usage
    };
  }

  private toToolCall(toolCall: ToolCallBuffer): ToolCall {
    return {
      type: ContentPartType.ToolCall,
      id: toolCall.id,
      name: toolCall.name,
      arguments: parseToolArguments(toolCall.argumentsText)
    };
  }

  private toStopReason(reason?: string | null): AgentMessage["stopReason"] {
    return mapStopReason(reason);
  }
}

// OpenAICompatibleTranslator bridges Atom's internal message format and the
// chat-completions style schema used by several providers. It keeps the mapping
// intentionally conservative so downstream providers can subclass it and tweak
// only the pieces their API variants disagree on.
export class OpenAICompatibleTranslator implements Translator<OpenAICompatibleRequest, OpenAICompatibleResponse> {
  toRequest(model: ModelDefinition, context: Context, options?: ProviderOptions): OpenAICompatibleRequest {
    return {
      model: model.id,
      messages: this.toMessages(context),
      tools: this.toTools(context.tools),
      temperature: options?.temperature,
      max_tokens: options?.maxOutputTokens,
      stream: false
    };
  }

  fromResponse(model: ModelDefinition, response: OpenAICompatibleResponse): AgentMessage {
    const choice = response.choices?.[0];
    const text = choice?.message?.content ?? "";
    const thinking = choice?.message?.reasoning ?? choice?.message?.reasoning_content ?? "";
    const toolCalls = (choice?.message?.tool_calls ?? []).map(
      (toolCall): ToolCall => ({
        type: ContentPartType.ToolCall,
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: parseToolArguments(toolCall.function.arguments)
      })
    );

    return {
      role: MessageRole.Assistant,
      api: model.api,
      model: model.id,
      responseId: response.id,
      content: [
        ...(thinking ? [{ type: ContentPartType.Thinking, text: thinking } as const] : []),
        ...(text ? [{ type: ContentPartType.Text, text } as const] : []),
        ...toolCalls
      ],
      stopReason: mapStopReason(choice?.finish_reason),
      usage: normalizeUsage(response.usage)
    };
  }

  toStreamingRequest(model: ModelDefinition, context: Context, options?: ProviderOptions): OpenAICompatibleRequest {
    return {
      ...this.toRequest(model, context, options),
      stream: true
    };
  }

  createStreamState(model: ModelDefinition): OpenAICompatibleStreamState {
    return new OpenAICompatibleStreamState(model);
  }

  protected toMessages(context: Context): OpenAICompatibleMessage[] {
    const messages: OpenAICompatibleMessage[] = [];

    if (context.system) {
      messages.push({ role: "system", content: context.system });
    }

    for (const message of context.messages) {
      if (message.role === MessageRole.User) {
        messages.push({ role: MessageRole.User, content: toUserContent(message.content) });
        continue;
      }

      if (message.role === MessageRole.Assistant) {
        const content = message.content
          .filter((part): part is TextPart => part.type === ContentPartType.Text)
          .map((part) => part.text)
          .join("\n");
        const toolCalls = message.content
          .filter((part): part is ToolCall => part.type === ContentPartType.ToolCall)
          .map((part) => ({
            id: part.id,
            type: "function" as const,
            function: {
              name: part.name,
              arguments: JSON.stringify(part.arguments)
            }
          }));

        messages.push({
          role: MessageRole.Assistant,
          content,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        });
        continue;
      }

      messages.push({
        role: MessageRole.Tool,
        tool_call_id: message.toolCallId,
        name: message.toolName,
        content: message.content.map((part) => part.text).join("\n")
      });
    }

    return messages;
  }

  protected toTools(tools?: ToolDefinition[]) {
    return tools?.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

}
