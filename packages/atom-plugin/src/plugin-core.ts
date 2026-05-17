import type { RuntimeEvent } from "@typegaro/atom-types";
import type { ToolDefinition } from "./sdk-types";

export interface PluginContext {
  workspaceRoot: string;
  sessionKey?: string;
  /** Emit a runtime event that the app layer can observe (e.g. bundle-reload). */
  emitRuntimeEvent?(event: RuntimeEvent): void;
}

export interface PluginTool extends ToolDefinition {
  run(args: Record<string, unknown>, context: PluginContext): Promise<string> | string;
}
