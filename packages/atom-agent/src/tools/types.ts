import type { ToolDefinition } from "atom-ai";
import type { Skill } from "atom-bundle";

export interface BuiltInToolContext {
  workspaceRoot: string;
  skills: Skill[];
}

export interface BuiltInTool {
  definition: ToolDefinition;
  run(arguments_: Record<string, unknown>, context: BuiltInToolContext): Promise<string>;
}
