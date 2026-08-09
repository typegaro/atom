import type { ChatStreamChunk } from "@openrouter/sdk/models";
import { ApiId } from "../../types/ids";
import { loadCustomModelsConfig } from "../../config/custom-models";
import { loadProviderApiKey } from "../../config/provider-files";
import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { AgentMessage, ThinkingPart } from "../../types/message";
import { MessageRole } from "../../types/message-role";
import { Provider, type ApiKeyResolver, type ProviderConfig, type ProviderModelProfile } from "../base/provider";
import { createConfiguredProvider, type ConfiguredProvider, type ProviderLoadContext } from "../../types/provider-definition";
import type { ProviderModule } from "../base/provider-module";
import { StreamEventSource, StreamEventType, type ProviderEvent } from "../../types/stream";
import type { ToolCall } from "../../types/tool";
import { EventStream } from "../../utils/event-stream";
import { buildOpenRouterMessages, convertOpenRouterTools } from "./openrouter-translator";
import { mapStopReason, normalizeUsage, parseToolArguments } from "../utils";

export function loadOpenRouterProviders(context: ProviderLoadContext): ConfiguredProvider[] {
  const config = loadCustomModelsConfig(context);
  const provider = config.providers.openrouter;

  if (!provider || provider.api !== ApiId.OpenRouter || provider.models.length === 0) {
    return [];
  }

  return [createConfiguredProvider({
    name: "openrouter",
    api: ApiId.OpenRouter,
    models: provider.models,
    resolveApiKey: () => loadProviderApiKey(context, provider.authName ?? "openrouter"),
    createProvider: (config, resolveApiKey) => new OpenRouterProvider(config, resolveApiKey)
  })];
}

type OpenRouterClient = {
  chat: {
    send(args: { chatRequest: unknown }): Promise<AsyncIterable<ChatStreamChunk>>;
  };
};

// Bun resolves the package's "source" export condition first, which points at a
// source tree that is not shipped in the npm package. Resolving through the
// exported "./package.json" entry and importing the sibling file avoids that
// broken condition while staying on the shipped ESM build.
async function loadOpenRouter(): Promise<new (options: { apiKey: string }) => OpenRouterClient> {
  const packageJsonUrl = import.meta.resolve("@openrouter/sdk/package.json");
  const entryUrl = new URL("./esm/index.js", packageJsonUrl).href;
  const sdk = await import(entryUrl);
  return sdk.OpenRouter as new (options: { apiKey: string }) => OpenRouterClient;
}

// OpenRouterProvider talks to the OpenRouter SDK directly because its streamed
// payload shape differs enough from the OpenAI-compatible path that a dedicated
// adapter is simpler than forcing it through the shared translator stack.
export class OpenRouterProvider extends Provider {
  protected modelProfile(): ProviderModelProfile {
    return {
      contextWindow: 32768,
      maxOutputTokens: 100_000,
      capabilities: {
        tools: true,
        streaming: true,
        images: true,
        reasoning: false
      }
    };
  }

  protected async runStream(
    context: Context,
    providerStream: EventStream<ProviderEvent, AgentMessage>,
    _signal?: AbortSignal
  ): Promise<AgentMessage> {
    const model = this.model;
    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new Error("OpenRouter provider requires an API key");
    }

    const OpenRouter = await loadOpenRouter();
    const client = new OpenRouter({ apiKey });
    const tools = convertOpenRouterTools(context.tools);
    const response = await client.chat.send({
      chatRequest: {
        model: model.id,
        messages: buildOpenRouterMessages(context),
        tools: tools as never,
        toolChoice: tools && tools.length > 0 ? "auto" : undefined,
        stream: true,
        maxTokens: model.maxOutputTokens
      } as never
    }) as unknown as AsyncIterable<ChatStreamChunk>;
    const startedMessage: AgentMessage = {
      role: MessageRole.Assistant,
      api: model.api,
      model: model.id,
      content: [],
      stopReason: "stop"
    };

    providerStream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageStart, message: startedMessage });

    let text = "";
    let thinking = "";
    let finishReason: string | null = null;
    let lastUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    const accumulatedToolCalls: Array<{
      id: string;
      name: string;
      arguments: string;
    }> = [];

    for await (const chunk of response) {
      if (chunk.error) {
        throw new Error(chunk.error.message || "Provider returned an error");
      }

      const choice = chunk.choices[0];
      if (!choice) {
        continue;
      }

      const delta = choice.delta;

      if (typeof delta.content === "string" && delta.content.length > 0) {
        text += delta.content;
        providerStream.push({ source: StreamEventSource.Provider, type: StreamEventType.TextDelta, contentIndex: 0, delta: delta.content });
      }

      if (typeof delta.reasoning === "string" && delta.reasoning.length > 0) {
        thinking += delta.reasoning;
        providerStream.push({ source: StreamEventSource.Provider, type: StreamEventType.ThinkingDelta, contentIndex: 0, delta: delta.reasoning });
      }

      if (delta.toolCalls) {
        for (const tc of delta.toolCalls) {
          const idx = tc.index;
          if (!accumulatedToolCalls[idx]) {
            accumulatedToolCalls[idx] = { id: tc.id ?? "", name: tc.function?.name ?? "", arguments: "" };
          }

          if (tc.id) {
            accumulatedToolCalls[idx].id = tc.id;
          }

          if (tc.function?.name) {
            accumulatedToolCalls[idx].name = tc.function.name;
          }

          if (tc.function?.arguments) {
            accumulatedToolCalls[idx].arguments += tc.function.arguments;
          }
        }
      }

      if (choice.finishReason) {
        finishReason = choice.finishReason;
      }

      if (chunk.usage) {
        lastUsage = {
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
          totalTokens: chunk.usage.totalTokens
        };
      }
    }

    const content: AgentMessage["content"] = [];

    if (thinking) {
      content.push({ type: ContentPartType.Thinking, text: thinking } satisfies ThinkingPart);
    }

    if (text) {
      content.push({ type: ContentPartType.Text, text });
    }

    const toolCallParts: ToolCall[] = accumulatedToolCalls
      .filter(Boolean)
      .map((tc) => ({
        type: ContentPartType.ToolCall,
        id: tc.id,
        name: tc.name,
        arguments: parseToolArguments(tc.arguments)
      }));

    for (const toolCall of toolCallParts) {
      content.push(toolCall);
      providerStream.push({ source: StreamEventSource.Provider, type: StreamEventType.ToolCall, toolCall });
    }

    const message: AgentMessage = {
      role: MessageRole.Assistant,
      api: model.api,
      model: model.id,
      content,
      usage: normalizeUsage(lastUsage),
      stopReason: mapStopReason(finishReason, toolCallParts.length > 0)
    };

    providerStream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageEnd, message });
    return message;
  }
}

export const openRouterProviderModule: ProviderModule<OpenRouterProvider> = {
  api: ApiId.OpenRouter,
  loadProviders: loadOpenRouterProviders
};
