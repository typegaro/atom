import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import {
  ApiId,
  createProviderLoadContext,
  loginAndSaveOpenAIResponsesAuth,
  modelsConfigPath,
  saveProviderApiKey
} from "atom-ai";
import type { AtomCliContext } from "../context";

type LoginProvider = "codex" | "deepseek" | "openrouter" | "openai-compatible";

const API_KEY_PROVIDERS: Record<Exclude<LoginProvider, "codex" | "openai-compatible">, { authName: string; api: ApiId }> = {
  deepseek: { authName: "deepseek", api: ApiId.DeepSeek },
  openrouter: { authName: "openrouter", api: ApiId.OpenRouter }
};

export function registerLoginCommand(program: Command, context: AtomCliContext): void {
  program
    .command("login")
    .argument("<provider>", "Provider to login: codex, deepseek, openrouter, openai-compatible")
    .description("Login to a provider")
    .action(async (provider: string) => {
      const normalizedProvider = normalizeProvider(provider);
      const providerContext = createProviderLoadContext();
      const rl = createInterface({ input, output });

      try {
        if (normalizedProvider === "codex") {
          await loginAndSaveOpenAIResponsesAuth(providerContext, {
            onAuth(info) {
              console.log(info.instructions ?? "Open this URL to continue:");
              console.log(info.url);

              const opener = process.platform === "darwin"
                ? "open"
                : process.platform === "win32"
                  ? "cmd"
                  : "xdg-open";
              const args = process.platform === "win32" ? ["/c", "start", info.url] : [info.url];

              try {
                const child = spawn(opener, args, { stdio: "ignore", detached: true });
                child.unref();
              } catch {
                // Manual copy still works when auto-open fails.
              }
            },
            async onPrompt(message) {
              return (await rl.question(`${message} `)).trim();
            },
            onProgress(message) {
              console.log(message);
            }
          });

          console.log(JSON.stringify({
            authPath: context.configPaths.oauth,
            provider: "codex",
            providerApi: ApiId.OpenAICodex
          }, null, 2));
          return;
        }

        if (normalizedProvider === "openai-compatible") {
          printOpenAICompatibleInstructions(providerContext.configDir, context.configPaths.oauth);
          return;
        }

        const config = API_KEY_PROVIDERS[normalizedProvider];
        const apiKey = await promptApiKey(rl, normalizedProvider);
        saveProviderApiKey(providerContext, config.authName, apiKey);

        console.log(JSON.stringify({
          authPath: context.configPaths.oauth,
          provider: normalizedProvider,
          providerApi: config.api
        }, null, 2));
      } finally {
        rl.close();
      }
    });
}

function normalizeProvider(provider: string): LoginProvider {
  const normalized = provider.trim().toLowerCase();

  if (normalized === "codex" || normalized === "openai-codex" || normalized === "openai-responses") {
    return "codex";
  }

  if (normalized === "deepseek") {
    return "deepseek";
  }

  if (normalized === "openrouter") {
    return "openrouter";
  }

  if (normalized === "openai-compatible" || normalized === "openai-completions") {
    return "openai-compatible";
  }

  throw new Error(`Unknown login provider: ${provider}. Supported providers: codex, deepseek, openrouter, openai-compatible`);
}

async function promptApiKey(rl: ReturnType<typeof createInterface>, provider: string): Promise<string> {
  const apiKey = (await rl.question(`Enter ${provider} API key: `)).trim();

  if (!apiKey) {
    throw new Error("API key cannot be empty");
  }

  return apiKey;
}

function printOpenAICompatibleInstructions(configDir: string, authPath: string): void {
  const path = modelsConfigPath({ cwd: process.cwd(), configDir });
  const example = {
    providers: {
      "my-openai-compatible-provider": {
        api: ApiId.OpenAICompletions,
        baseUrl: "http://localhost:11434/v1",
        authName: null,
        models: [
          { id: "gpt-oss:20b" }
        ]
      }
    }
  };

  console.log("OpenAI-compatible providers are configured as custom model providers.");
  console.log(`Add your provider and models to ${path}:`);
  console.log(JSON.stringify(example, null, 2));
  console.log("");
  console.log("If the endpoint requires an API key, set authName to a name (for example \"my-openai-compatible-provider\") and add an api-key entry to:");
  console.log(authPath);
  console.log(`Config directory: ${configDir}`);
}
