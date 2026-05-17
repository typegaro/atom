import type { ToolDefinition } from "./sdk-types";
export interface PluginContext {
    workspaceRoot: string;
    sessionKey?: string;
}
export interface PluginTool extends ToolDefinition {
    run(args: Record<string, unknown>, context: PluginContext): Promise<string> | string;
}
