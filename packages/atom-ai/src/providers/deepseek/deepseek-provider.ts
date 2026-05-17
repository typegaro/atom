import { ApiId } from "../../types/ids";
import { loadProviderApiKey } from "../../config/provider-files";
import type { ApiKeyResolver, ProviderConfig, ProviderModelProfile } from "../base/provider";
import { createConfiguredProvider, type ConfiguredProvider, type ProviderLoadContext } from "../../types/provider-definition";
import type { ProviderModule } from "../base/provider-module";
import { OpenAICompatibleTranslator } from "../openai-compatible/openai-compatible-translator";
import { ChatCompletionsProvider } from "../base/chat-completions-provider";
import { DeepSeekTranslator } from "./deepseek-translator";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-flash" },
  { id: "deepseek-v4-pro" }
];


export function loadDeepSeekProviders(context: ProviderLoadContext): ConfiguredProvider[] {
  return [createConfiguredProvider({
    name: "deepseek",
    api: ApiId.DeepSeek,
    models: DEEPSEEK_MODELS,
    resolveApiKey: () => loadProviderApiKey(context, "deepseek"),
    createProvider: (config, resolveApiKey) => new DeepSeekProvider(config, resolveApiKey)
  })];
}

// DeepSeekProvider is a small specialization of the OpenAI-compatible provider
// path: fixed base URL, built-in model list, and a translator that preserves
// DeepSeek's reasoning-specific request and response fields.
export class DeepSeekProvider extends ChatCompletionsProvider {
  private readonly deepSeekTranslator = new DeepSeekTranslator();

  constructor(config: ProviderConfig, resolveApiKey?: ApiKeyResolver) {
    super(config, resolveApiKey);
  }

  protected baseUrl(): string {
    return DEEPSEEK_BASE_URL;
  }

  protected translator(): OpenAICompatibleTranslator {
    return this.deepSeekTranslator;
  }

  protected modelProfile(): ProviderModelProfile {
    return {
      contextWindow: 32768,
      maxOutputTokens: 100_000,
      capabilities: {
        tools: true,
        streaming: true,
        images: false,
        reasoning: true
      }
    };
  }
}

export const deepSeekProviderModule: ProviderModule<DeepSeekProvider> = {
  api: ApiId.DeepSeek,
  loadProviders: loadDeepSeekProviders
};
