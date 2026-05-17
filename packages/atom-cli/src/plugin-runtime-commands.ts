import type { Command } from "commander";
import { AtomAppRuntime } from "atom-app";
import { BundleStore } from "atom-bundle";
import { PluginManager } from "atom-plugin-runtime";
import type { AtomCliContext } from "./context";

// Plugin CLI commands are loaded before argv parsing so they behave like native
// subcommands from the user's perspective.
export async function registerPluginRuntimeCommands(program: Command, context: AtomCliContext): Promise<void> {
  const bundles = new BundleStore();
  const allowList = new Set<string>(context.cliBundleName ? (bundles.resolvePlugins(context.cliBundleName) ?? []) : []);
  const pluginManager = new PluginManager([], allowList);
  await pluginManager.loadIfNeeded();
  const host = new AtomAppRuntime({
    pluginAllowList: allowList,
    provider: context.cliProviderName,
    modelId: context.cliModelId,
    includeMcp: true
  });

  for (const command of pluginManager.getCliCommands()) {
    await command.register(program, host);
  }
}
