import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { AtomConfigPath } from "@typegaro/atom-types";
import type { ProviderModelConfig } from "../providers/base/provider";
import type { ProviderLoadContext } from "../types/provider-definition";

export interface CustomProviderConfig {
  api: string;
  baseUrl?: string;
  authName?: string | null;
  models: ProviderModelConfig[];
}

export interface CustomModelsConfig {
  providers: Record<string, CustomProviderConfig>;
}

const DEFAULT_CUSTOM_MODELS_CONFIG: CustomModelsConfig = {
  providers: {}
};

export function modelsConfigPath(context: ProviderLoadContext): string {
  return resolve(context.configDir, AtomConfigPath.ModelsFile);
}

export function loadCustomModelsConfig(context: ProviderLoadContext): CustomModelsConfig {
  try {
    return JSON.parse(readFileSync(modelsConfigPath(context), "utf8")) as CustomModelsConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CUSTOM_MODELS_CONFIG;
    }

    throw error;
  }
}

export function saveCustomModelsConfig(context: ProviderLoadContext, config: CustomModelsConfig): void {
  const path = modelsConfigPath(context);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
