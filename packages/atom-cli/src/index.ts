#!/usr/bin/env bun

import { Command } from "commander";
import { createCliContext } from "./context";
import { registerPluginRuntimeCommands } from "./plugin-runtime-commands";
import { registerLoginCommand } from "./commands/login";
import { registerDoctorCommand } from "./commands/doctor";
import { registerChatCommand } from "./commands/chat";
import { registerModelsCommand } from "./commands/models";
import { registerInitCommands } from "./commands/init";
import { registerPluginCommands } from "./commands/plugin";
import { registerBundleCommands } from "./commands/bundle";

// The CLI entrypoint stays thin on purpose: it builds one shared context,
// registers built-in commands, then lets runtime plugins extend the command
// tree before Commander parses argv.

const program = new Command();
const context = createCliContext(Bun.argv);

program.name("atom").description("Atom local agent CLI");
program.showHelpAfterError();
program.showSuggestionAfterError();
program.option("-b, --bundle <name>", "Load only plugins from the named bundle");
program.option("-p, --provider <name>", "Provider name to use");
program.option("-m, --model <id>", "Model ID to use");

registerLoginCommand(program, context);
registerDoctorCommand(program, context);
registerChatCommand(program, context);
registerModelsCommand(program);
registerInitCommands(program);
registerPluginCommands(program, context);
registerBundleCommands(program);

await registerPluginRuntimeCommands(program, context);
if (Bun.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}
await program.parseAsync(Bun.argv);
