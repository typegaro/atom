import type { Command } from "commander";
import { AtomAppRuntime } from "atom-app";
import { BundleStore } from "atom-bundle";
import type { AtomCliContext } from "./context";

// Plugin CLI commands are loaded before argv parsing so they behave like native
// subcommands from the user's perspective. The runtime's own plugin manager is
// reused here so plugins are loaded exactly once per process.
export async function registerPluginRuntimeCommands(program: Command, context: AtomCliContext): Promise<void> {
  const bundles = new BundleStore();
  const allowList = new Set<string>(context.cliBundleName ? (bundles.resolvePlugins(context.cliBundleName) ?? []) : []);
  const host = new AtomAppRuntime({
    pluginAllowList: allowList,
    provider: context.cliProviderName,
    modelId: context.cliModelId,
    includeMcp: true
  });

  const pluginManager = host.bundleManager.pluginManager;
  await pluginManager.loadIfNeeded();

  for (const command of pluginManager.getCliCommands()) {
    await command.register(program, host);
  }
}
