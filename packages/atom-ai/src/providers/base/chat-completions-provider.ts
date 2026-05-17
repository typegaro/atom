import OpenAI from "openai";
import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { AgentMessage } from "../../types/message";
import { Provider, type ProviderOptions } from "./provider";
import { StreamEventSource, StreamEventType, type ProviderEvent } from "../../types/stream";
import { EventStream } from "../../utils/event-stream";
import {
  OpenAICompatibleTranslator,
  type OpenAICompatibleChunk
} from "../openai-compatible/openai-compatible-translator";

const OPENAI_COMPATIBLE_API_KEY_PLACEHOLDER = "not-needed";

// Template for chat-completions style providers. The request/response shape is
// shared by OpenAI-compatible APIs, while provider subclasses only choose auth,
// base URL, headers, translator tweaks, and model capabilities.
export abstract class ChatCompletionsProvider extends Provider {
  protected abstract baseUrl(): string;
  protected abstract translator(): OpenAICompatibleTranslator;

  protected apiKeyRequired(): boolean {
    return true;
  }

  protected apiKeyPlaceholder(): string {
    return OPENAI_COMPATIBLE_API_KEY_PLACEHOLDER;
  }

  protected requestOptions(signal?: AbortSignal): ProviderOptions {
    return { signal };
  }

  protected clientHeaders(_apiKey: string): Record<string, string> | undefined {
    return undefined;
  }

  protected async runStream(
    context: Context,
    stream: EventStream<ProviderEvent, AgentMessage>,
    signal?: AbortSignal
  ): Promise<AgentMessage> {
    const apiKey = await this.resolveApiKey();

    if (!apiKey && this.apiKeyRequired()) {
      throw new Error(`${this.name} provider requires an API key`);
    }

    const client = new OpenAI({
      apiKey: apiKey ?? this.apiKeyPlaceholder(),
      baseURL: this.baseUrl().replace(/\/+$/, ""),
      defaultHeaders: apiKey ? this.clientHeaders(apiKey) : undefined
    });

    const translator = this.translator();
    const streamingRequest = translator.toStreamingRequest(this.model, context, this.requestOptions(signal));
    const response = await client.chat.completions.create(streamingRequest as never, { signal });
    const state = translator.createStreamState(this.model);
    let started = false;

    for await (const chunk of response as unknown as AsyncIterable<OpenAICompatibleChunk>) {
      const events = state.applyChunk(chunk);

      if (!started) {
        stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageStart, message: state.finalize() });
        started = true;
      }

      for (const event of events) {
        stream.push(event);
      }
    }

    const message = state.finalize();

    for (const part of message.content) {
      if (part.type === ContentPartType.ToolCall) {
        stream.push({ source: StreamEventSource.Provider, type: StreamEventType.ToolCall, toolCall: part });
      }
    }

    if (!started) {
      stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageStart, message });
    }

    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageEnd, message });
    return message;
  }
}
