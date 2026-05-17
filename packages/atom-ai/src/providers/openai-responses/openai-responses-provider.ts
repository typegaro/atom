import OpenAI from "openai";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { ApiId } from "../../types/ids";
import { loadProviderAuth, saveProviderAuth } from "../../config/provider-files";
import { createConfiguredProvider, type ConfiguredProvider, type ProviderLoadContext } from "../../types/provider-definition";
import type { ProviderModule } from "../base/provider-module";
import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { AgentMessage } from "../../types/message";
import { Provider, type ProviderModelProfile } from "../base/provider";
import { StreamEventSource, StreamEventType, type ProviderEvent } from "../../types/stream";
import { EventStream } from "../../utils/event-stream";
import {
  buildMessageFromResponse,
  buildRequestBody,
  createEmptyMessage,
  type CodexOutputItem,
  type CodexResponse,
  resolveResponsesBaseUrl,
  setOutputItem
} from "./openai-responses-mapper";
import {
  extractOpenAIResponsesAccountId,
  loginOpenAIResponses,
  refreshOpenAIResponsesToken,
  type OpenAIResponsesCredentials,
  type OpenAIResponsesLoginOptions
} from "./openai-responses-oauth";

const OPENAI_RESPONSES_PROVIDER_NAME = "codex";

export function loadOpenAIResponsesProviders(context: ProviderLoadContext): ConfiguredProvider[] {
  return [createConfiguredProvider({
    name: OPENAI_RESPONSES_PROVIDER_NAME,
    api: ApiId.OpenAICodex,
    models: [
      { id: "gpt-5.4" },
      { id: "gpt-5.5" }
    ],
    resolveApiKey: () => loadOrRefreshOpenAIResponsesToken(context),
    createProvider: (config, resolveApiKey) => new OpenAIResponsesProvider(config, resolveApiKey)
  })];
}

export async function loadOrRefreshOpenAIResponsesToken(context: ProviderLoadContext): Promise<string | undefined> {
  const entry = loadProviderAuth(context, OPENAI_RESPONSES_PROVIDER_NAME);

  if (!entry) {
    throw new Error("Missing Codex OAuth credentials. Run `atom login codex` first.");
  }

  if (entry.type !== "oauth") {
    throw new Error(`Auth entry ${OPENAI_RESPONSES_PROVIDER_NAME} is not an oauth entry`);
  }

  if (Date.now() < entry.expires) {
    return entry.access;
  }

  const refreshed = await refreshOpenAIResponsesToken(entry.refresh);
  saveProviderAuth(context, OPENAI_RESPONSES_PROVIDER_NAME, {
    type: "oauth",
    access: refreshed.access,
    refresh: refreshed.refresh,
    expires: refreshed.expires
  });
  return refreshed.access;
}

export async function loginAndSaveOpenAIResponsesAuth(
  context: ProviderLoadContext,
  options: OpenAIResponsesLoginOptions
): Promise<OpenAIResponsesCredentials> {
  const credentials = await loginOpenAIResponses(options);
  saveProviderAuth(context, OPENAI_RESPONSES_PROVIDER_NAME, {
    type: "oauth",
    access: credentials.access,
    refresh: credentials.refresh,
    expires: credentials.expires
  });
  return credentials;
}

// OpenAIResponsesProvider speaks the Responses API directly because its event
// model does not line up cleanly with chat-completions streaming. The provider
// normalizes those lower-level events into Atom's common stream contract so the
// agent loop does not need provider-specific branching.
export class OpenAIResponsesProvider extends Provider {
  protected modelProfile(): ProviderModelProfile {
    return {
      contextWindow: 32768,
      maxOutputTokens: 100_000,
      capabilities: {
        tools: true,
        streaming: true,
        images: true,
        reasoning: true
      }
    };
  }

  protected async runStream(
    context: Context,
    stream: EventStream<ProviderEvent, AgentMessage>,
    signal?: AbortSignal
  ): Promise<AgentMessage> {
    const model = this.model;
    const startedMessage = createEmptyMessage(model);
    let text = "";
    let thinking = "";
    let completedResponse: CodexResponse | undefined;
    const streamedOutput: CodexOutputItem[] = [];

    const apiKey = await this.resolveApiKey();
    if (!apiKey) {
      throw new Error("OpenAI Codex provider requires an OAuth access token");
    }

    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageStart, message: startedMessage });

    const client = new OpenAI({
      apiKey,
      baseURL: resolveResponsesBaseUrl(this.config.baseUrl),
      defaultHeaders: {
        "OpenAI-Beta": "responses=experimental",
        "chatgpt-account-id": extractOpenAIResponsesAccountId(apiKey),
        originator: "atom",
        "User-Agent": "atom"
      }
    });

    const { data: responseStream } = await client.responses.create(buildRequestBody(model, context), {
      signal
    }).withResponse();

    for await (const event of responseStream as AsyncIterable<ResponseStreamEvent>) {
      const type = event.type;

      if (type === "response.output_text.delta") {
        const delta = event.delta;
        if (delta) {
          text += delta;
          stream.push({ source: StreamEventSource.Provider, type: StreamEventType.TextDelta, contentIndex: 0, delta });
        }
        continue;
      }

      if (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") {
        const delta = event.delta;
        if (delta) {
          thinking += delta;
          stream.push({ source: StreamEventSource.Provider, type: StreamEventType.ThinkingDelta, contentIndex: 0, delta });
        }
        continue;
      }

      if (type === "response.reasoning_summary_text.done" || type === "response.reasoning_text.done") {
        const delta = event.text;
        if (delta && !thinking) {
          thinking = delta;
          stream.push({ source: StreamEventSource.Provider, type: StreamEventType.ThinkingDelta, contentIndex: 0, delta });
        }
        continue;
      }

      if (type === "response.output_item.done") {
        const outputIndex = typeof event.output_index === "number" ? event.output_index : streamedOutput.length;
        setOutputItem(streamedOutput, outputIndex, event.item as unknown as CodexOutputItem);
        continue;
      }

      if (type === "response.function_call_arguments.done") {
        const outputIndex = typeof event.output_index === "number" ? event.output_index : streamedOutput.length;
        setOutputItem(streamedOutput, outputIndex, {
          type: "function_call",
          call_id: event.item_id,
          name: event.name,
          arguments: event.arguments
        });
        continue;
      }

      if (type === "response.completed" || type === "response.incomplete") {
        completedResponse = {
          ...(event.response ?? {}) as CodexResponse,
          output: ((event.response as CodexResponse | undefined)?.output?.length
            ? (event.response as CodexResponse).output
            : streamedOutput.filter(Boolean))
        };
        break;
      }

      if (type === "response.failed" || type === "error") {
        const eventError = (event as { error?: { message?: unknown } }).error;
        const message = typeof eventError?.message === "string"
          ? eventError.message
          : "OpenAI Codex request failed";
        throw new Error(message);
      }
    }

    const message = buildMessageFromResponse(
      model,
      completedResponse ?? { output: streamedOutput.filter(Boolean) },
      text,
      thinking
    );

    for (const part of message.content) {
      if (part.type === ContentPartType.ToolCall) {
        stream.push({ source: StreamEventSource.Provider, type: StreamEventType.ToolCall, toolCall: part });
      }
    }

    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageEnd, message });
    return message;
  }
}

export const openAIResponsesProviderModule: ProviderModule<OpenAIResponsesProvider> = {
  api: ApiId.OpenAICodex,
  loadProviders: loadOpenAIResponsesProviders
};

export {
  extractOpenAIResponsesAccountId,
  loginOpenAIResponses,
  refreshOpenAIResponsesToken
};
export type { OpenAIResponsesCredentials, OpenAIResponsesLoginOptions };
export { OpenAIResponsesProvider as OpenAICodexProvider };
export {
  extractOpenAIResponsesAccountId as extractOpenAICodexAccountId,
  loginOpenAIResponses as loginOpenAICodex,
  refreshOpenAIResponsesToken as refreshOpenAICodexToken
};
export type {
  OpenAIResponsesCredentials as OpenAICodexCredentials,
  OpenAIResponsesLoginOptions as OpenAICodexLoginOptions
};
