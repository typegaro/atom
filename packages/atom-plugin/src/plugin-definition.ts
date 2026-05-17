import type { PluginTool } from "./plugin-core";
import type { PluginSetupContext } from "./plugin-hooks";
import type { PluginBackground, PluginCapabilityName, PluginChannel, PluginCliCommand } from "./plugin-runtime";
import type { PluginPanelDefinition, PluginView } from "./plugin-ui";

// AtomPluginDefinition is the public plugin authoring surface. A plugin mostly
// declares static capabilities and optional runtime entrypoints, then uses the
// setup callback to register hooks and events against the provided context.
export interface AtomPluginDefinition {
  id: string;
  capabilities: PluginCapabilityName[];
  instructions?: string[];
  tools?: PluginTool[];
  panels?: PluginPanelDefinition[];
  views?: PluginView[];
  cliCommands?: PluginCliCommand[];
  channels?: PluginChannel[];
  backgrounds?: PluginBackground[];
  setup?(context: PluginSetupContext): void | Promise<void>;
}

// `definePlugin()` is a tiny identity helper that preserves the full generic
// type of the plugin object for authors without changing runtime behavior.
export function definePlugin<T extends AtomPluginDefinition>(plugin: T): T {
  return plugin;
}
