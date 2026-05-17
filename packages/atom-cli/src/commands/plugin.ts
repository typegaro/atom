import type { Command } from "commander";
import { PluginSourceLocator, type ConfigScope } from "atom-plugin-runtime";
import type { AtomCliContext } from "../context";
import { runNpmInstall, runNpmRemove } from "../plugin-package-manager";

export function registerPluginCommands(program: Command, context: AtomCliContext): void {
  const plugins = new PluginSourceLocator();
  const pluginProgram = program
    .command("plugin")
    .description("Manage Atom plugins");

  pluginProgram
    .command("list")
    .description("List discovered plugins")
    .action(() => {
      const sources = plugins.listSources().map((source) => ({
        name: source.name,
        scope: source.scope,
        path: source.path
      }));
      console.log(JSON.stringify({ plugins: sources }, null, 2));
    });

  pluginProgram
    .command("install")
    .description("Install an Atom plugin from npm or Git")
    .argument("<packageSpec>", "npm package name, Git URL, or GitHub shorthand")
    .option("-l, --local", "Install into ./.atom/npm", false)
    .option("-D, --dev", "Install as a dev dependency", false)
    .action(async (packageSpec: string, options: { local?: boolean; dev?: boolean }) => {
      const scope = options.local ? "local" : "global";
      await runNpmInstall(pluginInstallPrefix(context, scope), packageSpec, Boolean(options.dev));
    });

  pluginProgram
    .command("uninstall")
    .description("Uninstall an npm-based Atom plugin")
    .argument("<packageName>", "npm package name")
    .option("-l, --local", "Uninstall from ./.atom/npm", false)
    .action(async (packageName: string, options: { local?: boolean }) => {
      const scope = options.local ? "local" : "global";
      await runNpmRemove(pluginInstallPrefix(context, scope), packageName);
    });
}

function pluginInstallPrefix(context: AtomCliContext, scope: ConfigScope): string {
  return scope === "local" ? context.configPaths.localNpmDir : context.configPaths.npmDir;
}
