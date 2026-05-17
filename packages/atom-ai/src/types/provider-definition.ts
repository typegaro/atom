import type { ApiKeyResolver, Provider, ProviderConfig, ProviderModelConfig } from "../providers/base/provider";
import type { ModelDefinition } from "./model";

export type ProviderCreator<TProvider extends Provider = Provider> = (
  config: ProviderConfig,
  resolveApiKey?: ApiKeyResolver
) => TProvider;

export interface ConfiguredProvider {
  name: string;
  api: string;
  baseUrl?: string;
  models: ProviderModelConfig[];
  create(modelId: string): Provider;
}

export interface ProviderLoadContext {
  cwd: string;
  configDir: string;
}

export type ConfiguredProviderLoader = (
  context: ProviderLoadContext
) => ConfiguredProvider[] | Promise<ConfiguredProvider[]>;

export interface ModelSelection {
  provider: string;
  model: string;
}

export interface AgentRuntime {
  provider: string;
  model: ModelDefinition;
  providerRuntime: Provider;
}

export interface AvailableModelSettings extends ProviderModelConfig {
  provider: string;
  api: string;
  baseUrl?: string;
}

interface ConfiguredProviderSpec<TProvider extends Provider = Provider> {
  name: string;
  api: string;
  baseUrl?: string;
  models: ProviderModelConfig[];
  resolveApiKey?: ApiKeyResolver;
  createProvider: ProviderCreator<TProvider>;
}

export function createConfiguredProvider<TProvider extends Provider = Provider>(
  spec: ConfiguredProviderSpec<TProvider>
): ConfiguredProvider {
  return {
    name: spec.name,
    api: spec.api,
    baseUrl: spec.baseUrl,
    models: spec.models,
    create(modelId: string): TProvider {
      const model = spec.models.find((candidate) => candidate.id === modelId);

      if (!model) {
        throw new Error(`Unknown model ${modelId} for provider ${spec.name}`);
      }

      return spec.createProvider({
        name: spec.name,
        api: spec.api,
        baseUrl: spec.baseUrl,
        model
      }, spec.resolveApiKey);
    }
  };
}
