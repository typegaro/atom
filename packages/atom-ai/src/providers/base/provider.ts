import type { Context } from "../../types/context";
import type { ModelDefinition } from "../../types/model";
import type { AgentMessage } from "../../types/message";
import { StreamEventSource, StreamEventType, type ProviderEvent, type ProviderStream } from "../../types/stream";
import { EventStream } from "../../utils/event-stream";

export interface ProviderModelConfig {
  id: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface ProviderConfig {
  name: string;
  api: string;
  model: ProviderModelConfig;
  baseUrl?: string;
}

export interface ProviderOptions {
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export type ApiKeyResolver = () => Promise<string | undefined>;

export interface Translator<TRequest, TResponse> {
  toRequest(model: ModelDefinition, context: Context, options?: ProviderOptions): TRequest;
  fromResponse(model: ModelDefinition, response: TResponse): AgentMessage;
}

export interface ProviderModelProfile {
  contextWindow: number;
  maxOutputTokens?: number;
  capabilities: ModelDefinition["capabilities"];
}

export abstract class Provider {
  readonly name: string;
  readonly api: string;
  readonly config: ProviderConfig;
  readonly model: ModelDefinition;

  constructor(
    config: ProviderConfig,
    private readonly resolveApiKeyFn?: ApiKeyResolver
  ) {
    this.name = config.name;
    this.api = config.api;
    this.config = config;
    this.model = this.toModelDefinition(config);
  }

  stream(context: Context, signal?: AbortSignal): ProviderStream {
    const stream = new EventStream<ProviderEvent, AgentMessage>();

    void (async () => {
      try {
        const message = await this.runStream(context, stream, signal);
        stream.end(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stream.push({ source: StreamEventSource.Provider, type: StreamEventType.Error, error: message });
        stream.fail(error);
      }
    })();

    return stream;
  }

  protected async resolveApiKey(): Promise<string | undefined> {
    return this.resolveApiKeyFn ? await this.resolveApiKeyFn() : undefined;
  }

  protected toModelDefinition(config: ProviderConfig): ModelDefinition {
    const profile = this.modelProfile();

    return {
      id: config.model.id,
      name: config.model.id,
      api: this.api as ModelDefinition["api"],
      contextWindow: config.model.contextWindow ?? profile.contextWindow,
      maxOutputTokens: config.model.maxOutputTokens ?? profile.maxOutputTokens,
      capabilities: profile.capabilities
    };
  }

  protected abstract modelProfile(): ProviderModelProfile;

  protected abstract runStream(
    context: Context,
    stream: EventStream<ProviderEvent, AgentMessage>,
    signal?: AbortSignal
  ): Promise<AgentMessage>;
}
