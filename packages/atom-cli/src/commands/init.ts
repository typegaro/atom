import type { Command } from "commander";
import { resolve } from "node:path";
import { scaffoldPluginTemplate } from "../plugin-scaffold";

export function registerInitCommands(program: Command): void {
  const initProgram = program
    .command("init")
    .description("Scaffold Atom projects");

  initProgram
    .command("plugin")
    .description("Create a new Atom plugin template")
    .argument("[directory]", "target directory", "atom-my-plugin")
    .option("--name <packageName>", "package name to write into package.json")
    .option("--id <pluginId>", "plugin id to use in definePlugin")
    .option("--skip-install", "Do not run bun install after scaffolding", false)
    .action(async (directory: string, options: { name?: string; id?: string; skipInstall?: boolean }) => {
      const targetDir = resolve(process.cwd(), directory);
      await scaffoldPluginTemplate(targetDir, {
        packageName: options.name,
        pluginId: options.id,
        installDependencies: !options.skipInstall
      });
    });
}
