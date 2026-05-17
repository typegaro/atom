import type { PluginTool } from "./plugin-core";
import type { PluginSetupContext } from "./plugin-hooks";
import type { PluginBackground, PluginCapabilityName, PluginChannel, PluginCliCommand } from "./plugin-runtime";
import type { PluginPanelDefinition, PluginView } from "./plugin-ui";
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
export declare function definePlugin<T extends AtomPluginDefinition>(plugin: T): T;
