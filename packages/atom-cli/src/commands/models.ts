import type { Command } from "commander";
import { ProviderRegistry } from "atom-ai";

export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("List available provider models")
    .option("-p, --provider <name>", "Only list models for one provider")
    .action(async (options: { provider?: string }) => {
      const providerRegistry = new ProviderRegistry();
      console.log(JSON.stringify({ models: await providerRegistry.listModels(options.provider) }, null, 2));
    });
}
