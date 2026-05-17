import type { RuntimeEvent } from "@typegaro/atom-types";
import type { McpManager } from "atom-mcp";
import type { Skill } from "atom-bundle";
import { ContentPartType, MessageRole, type ToolCall, type ToolResultMessage } from "atom-ai";
import type { PluginManager } from "atom-plugin-runtime";
import { getBuiltInTool } from "./tools";

export interface AgentToolRuntimeOptions {
  workspaceRoot: string;
  pluginManager: PluginManager;
  mcpManager: McpManager;
  skills: Skill[];
  sessionKey?: string;
  /** Callback for plugin tools to emit runtime events (e.g. bundle-reload). */
  emitRuntimeEvent?: (event: RuntimeEvent) => void;
}

// AgentToolRuntime owns the built-in tool surface and the handoff to dynamic
// plugin and MCP tools. The dispatch stays centralized here so the rest of the
// agent loop only deals with `ToolCall` and `ToolResultMessage` objects.
export class AgentToolRuntime {
  private readonly workspaceRoot: string;
  private readonly pluginManager: PluginManager;
  private readonly mcpManager: McpManager;
  private readonly skills: Skill[];
  private readonly sessionKey: string | undefined;
  private readonly emitRuntimeEvent?: (event: RuntimeEvent) => void;

  constructor(options: AgentToolRuntimeOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.pluginManager = options.pluginManager;
    this.mcpManager = options.mcpManager;
    this.skills = options.skills;
    this.sessionKey = options.sessionKey;
    this.emitRuntimeEvent = options.emitRuntimeEvent;
  }

  // Built-in tools are handled directly. Everything else is delegated to the
  // plugin registry or MCP manager using the tool name as the routing key.
  async runTool(toolCall: ToolCall): Promise<ToolResultMessage> {
    try {
      const builtInTool = getBuiltInTool(toolCall.name, this.skills);

      if (builtInTool) {
        return this.createToolResult(
          toolCall,
          await builtInTool.run(toolCall.arguments, {
            workspaceRoot: this.workspaceRoot,
            skills: this.skills
          }),
          false
        );
      }

      return this.createToolResult(toolCall, await this.runDynamicTool(toolCall), false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.createToolResult(toolCall, message, true);
    }
  }

  private createToolResult(toolCall: ToolCall, text: string, isError: boolean): ToolResultMessage {
    return {
      role: MessageRole.Tool,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: [{ type: ContentPartType.Text, text }],
      isError
    };
  }

  private async runDynamicTool(toolCall: ToolCall): Promise<string> {
    if (toolCall.name.startsWith("mcp_")) {
      return await this.mcpManager.callTool(toolCall.name, toolCall.arguments);
    }

    const tool = this.pluginManager.getTool(toolCall.name);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }

    return await tool.run(toolCall.arguments, {
      workspaceRoot: this.workspaceRoot,
      sessionKey: this.sessionKey,
      emitRuntimeEvent: this.emitRuntimeEvent
    });
  }
}
