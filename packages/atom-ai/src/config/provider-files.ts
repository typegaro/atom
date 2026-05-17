import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { AtomConfigPath } from "@typegaro/atom-types";
import type { ProviderLoadContext } from "../types/provider-definition";

export type ProviderAuthEntry =
  | { type: "api-key"; apiKey: string }
  | { type: "oauth"; access: string; refresh: string; expires: number };

export interface ProviderAuthFile {
  providers: Record<string, ProviderAuthEntry>;
}

export function createProviderLoadContext(cwd = process.cwd()): ProviderLoadContext {
  const configFolderOverride = process.env.CONFIG_FOLDER?.trim();
  return {
    cwd,
    configDir: configFolderOverride ? resolve(configFolderOverride) : resolve(homedir(), AtomConfigPath.DirName)
  };
}

export function loadProviderAuthFile(context: ProviderLoadContext): ProviderAuthFile {
  return readJsonFile(resolve(context.configDir, AtomConfigPath.OAuthFile), { providers: {} });
}

export function saveProviderAuthFile(context: ProviderLoadContext, value: ProviderAuthFile): void {
  writeJsonFile(resolve(context.configDir, AtomConfigPath.OAuthFile), value);
}

export function loadProviderAuth(context: ProviderLoadContext, name: string): ProviderAuthEntry | undefined {
  return loadProviderAuthFile(context).providers[name];
}

export function saveProviderAuth(context: ProviderLoadContext, name: string, entry: ProviderAuthEntry): void {
  const auth = loadProviderAuthFile(context);
  saveProviderAuthFile(context, {
    providers: {
      ...auth.providers,
      [name]: entry
    }
  });
}

export async function loadProviderApiKey(context: ProviderLoadContext, name: string): Promise<string | undefined> {
  const entry = loadProviderAuth(context, name);

  if (!entry) {
    throw new Error(`Missing auth entry for provider: ${name}`);
  }

  if (entry.type !== "api-key") {
    throw new Error(`Auth entry ${name} is not an api-key entry`);
  }

  return entry.apiKey;
}

export function saveProviderApiKey(context: ProviderLoadContext, name: string, apiKey: string): void {
  saveProviderAuth(context, name, { type: "api-key", apiKey });
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function writeJsonFile<T>(path: string, value: T): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
