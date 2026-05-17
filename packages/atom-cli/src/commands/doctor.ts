import type { Command } from "commander";
import { AgentBundleManager } from "atom-bundle";
import { createAgentConfig } from "atom-agent";
import { ATOM_AI_NAME } from "atom-ai";
import type { AtomCliContext } from "../context";

export function registerDoctorCommand(program: Command, context: AtomCliContext): void {
  program
    .command("doctor")
    .description("Check local agent wiring")
    .action(async () => {
      const bundleManager = new AgentBundleManager({ includeMcp: true });
      await bundleManager.loadIfNeeded();
      const models = await bundleManager.listModels();

      let core: ReturnType<typeof createAgentConfig> | null = null;

      if (context.cliProviderName && context.cliModelId) {
        const runtime = await bundleManager.createAgentRuntime({
          provider: context.cliProviderName,
          model: context.cliModelId
        });
        core = createAgentConfig("atom-cli", runtime);
      }

      console.log(JSON.stringify({
        core,
        ai: { name: ATOM_AI_NAME },
        settingsPath: context.configPaths.settings,
        authPath: context.configPaths.oauth,
        models,
        mcp: {
          connectedServers: bundleManager.mcpManager?.getConnectedServerCount() ?? 0,
          tools: bundleManager.mcpManager?.getToolDefinitions().map((tool) => tool.name) ?? []
        }
      }, null, 2));
    });
}
