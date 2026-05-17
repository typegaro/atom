import { createProviderLoadContext } from "../config/provider-files";
import { deepSeekProviderModule } from "../providers/deepseek/deepseek-provider";
import { openAICompatibleProviderModule } from "../providers/openai-compatible/openai-compatible-provider";
import { openAIResponsesProviderModule } from "../providers/openai-responses/openai-responses-provider";
import { openRouterProviderModule } from "../providers/openrouter/openrouter-provider";
import type { ProviderModule } from "../providers/base/provider-module";
import type { AgentRuntime, AvailableModelSettings, ConfiguredProvider, ModelSelection } from "../types/provider-definition";

const builtInProviderModules = [
  deepSeekProviderModule,
  openAIResponsesProviderModule,
  openAICompatibleProviderModule,
  openRouterProviderModule
];

// ProviderRegistry is the single index over configured model providers.
//
// Provider modules know how to discover provider configs and build runtime
// instances. This registry keeps that dynamic loading behind one lookup surface
// so callers can ask for models or runtimes without caring about provider APIs.
export class ProviderRegistry {
  private readonly modulesByApi = new Map<string, ProviderModule>();
  private readonly providersByName = new Map<string, ConfiguredProvider>();
  private loaded = false;
  private loadPromise?: Promise<void>;

  constructor(private readonly cwd = process.cwd()) {
    this.registerBuiltIns();
  }

  register(module: ProviderModule): void {
    this.modulesByApi.set(module.api, module);
    this.loaded = false;
    this.loadPromise = undefined;
  }

  async load(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      const context = createProviderLoadContext(this.cwd);
      const providers = (await Promise.all(
        [...this.modulesByApi.values()].map((module) => module.loadProviders(context))
      )).flat();

      this.providersByName.clear();
      for (const provider of providers) {
        this.providersByName.set(provider.name, provider);
      }

      this.loaded = true;
    })();

    await this.loadPromise;
  }

  async listModels(provider?: string): Promise<AvailableModelSettings[]> {
    await this.loadIfNeeded();
    const providers = provider ? [this.requireProvider(provider)] : [...this.providersByName.values()];

    return providers.flatMap((provider) => provider.models.map((model) => ({
      ...model,
      provider: provider.name,
      api: provider.api,
      baseUrl: provider.baseUrl
    })));
  }

  async createAgentRuntime(selection: ModelSelection): Promise<AgentRuntime> {
    await this.loadIfNeeded();
    const configuredProvider = this.requireProvider(selection.provider);
    const provider = configuredProvider.create(selection.model);

    return {
      provider: configuredProvider.name,
      model: provider.model,
      providerRuntime: provider
    };
  }

  private registerBuiltIns(): void {
    for (const module of builtInProviderModules) {
      this.modulesByApi.set(module.api, module);
    }
  }

  private async loadIfNeeded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  private requireProvider(name: string): ConfiguredProvider {
    const provider = this.providersByName.get(name);

    if (!provider) {
      throw new Error(`Unknown provider: ${name}`);
    }

    return provider;
  }
}
