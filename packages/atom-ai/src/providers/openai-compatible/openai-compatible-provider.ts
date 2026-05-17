import OpenAI from "openai";
import { ApiId } from "../../types/ids";
import { loadCustomModelsConfig } from "../../config/custom-models";
import { loadProviderApiKey } from "../../config/provider-files";
import type { ApiKeyResolver, ProviderConfig, ProviderModelProfile } from "../base/provider";
import { createConfiguredProvider, type ConfiguredProvider, type ProviderLoadContext } from "../../types/provider-definition";
import type { ProviderModule } from "../base/provider-module";
import { ChatCompletionsProvider } from "../base/chat-completions-provider";
import { OpenAICompatibleTranslator } from "./openai-compatible-translator";

interface OpenAICompatibleModelsResponse {
  data?: Array<{
    id: string;
  }>;
}

const OPENAI_COMPATIBLE_API_KEY_PLACEHOLDER = "not-needed";

export function loadOpenAICompatibleProviders(context: ProviderLoadContext): ConfiguredProvider[] {
  const config = loadCustomModelsConfig(context);

  return Object.entries(config.providers)
    .filter(([, provider]) => provider.api === ApiId.OpenAICompletions)
    .map(([name, provider]) => createConfiguredProvider({
      name,
      api: ApiId.OpenAICompletions,
      baseUrl: provider.baseUrl,
      models: provider.models,
      resolveApiKey: provider.authName ? () => loadProviderApiKey(context, provider.authName!) : undefined,
      createProvider: (providerConfig, resolveApiKey) => new OpenAICompatibleProvider(providerConfig, resolveApiKey)
    }));
}

export async function listOpenAICompatibleModels(baseUrl: string): Promise<string[]> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const client = new OpenAI({ apiKey: OPENAI_COMPATIBLE_API_KEY_PLACEHOLDER, baseURL: normalizedBaseUrl });
  const payload = (await client.models.list()) as OpenAICompatibleModelsResponse;
  return (payload.data ?? []).map((model) => model.id);
}

export async function resolveOpenAICompatibleModel(
  baseUrl: string,
  preferredModel?: string
): Promise<string> {
  if (preferredModel) {
    return preferredModel;
  }

  const models = await listOpenAICompatibleModels(baseUrl);

  if (models.length === 0) {
    throw new Error("No models available from the OpenAI-compatible endpoint");
  }

  return (
    models.find((model) => model.includes("gpt-oss")) ??
    models.find((model) => !model.includes("embedding")) ??
    models[0]
  );
}

// OpenAICompatibleProvider is the shared provider implementation for APIs that
// follow the chat-completions contract closely enough to reuse one transport and
// translator stack.
export class OpenAICompatibleProvider extends ChatCompletionsProvider {
  private readonly openAITranslator: OpenAICompatibleTranslator;

  constructor(config: ProviderConfig, resolveApiKey?: ApiKeyResolver, translator = new OpenAICompatibleTranslator()) {
    super(config, resolveApiKey);
    this.openAITranslator = translator;
  }

  protected baseUrl(): string {
    if (!this.config.baseUrl) {
      throw new Error(`Provider ${this.name} requires a baseUrl`);
    }

    return this.config.baseUrl;
  }

  protected translator(): OpenAICompatibleTranslator {
    return this.openAITranslator;
  }

  protected override apiKeyRequired(): boolean {
    return false;
  }

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
}

export const openAICompatibleProviderModule: ProviderModule<OpenAICompatibleProvider> = {
  api: ApiId.OpenAICompletions,
  loadProviders: loadOpenAICompatibleProviders
};
