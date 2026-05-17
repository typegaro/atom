import type { ToolDefinition } from "atom-ai";
import type { PluginManager } from "atom-plugin-runtime";
import type { McpManager } from "atom-mcp";
import type { Skill } from "./skills";
import type { PromptShard } from "./prompt";

// AgentBundle is the fully resolved, pre-loaded set of everything an agent
// needs to run: tools, prompt shards, skills, and the managers for runtime
// plugin/MCP dispatch. The agent never calls loadSkills() or scans for plugins
// itself — it receives this bundle from the AgentBundleManager.
export interface AgentBundle {
  /** Bundle name (e.g. "default", "code-review"). */
  name: string;

  /** Default model id for agents created with this bundle, if set. */
  model?: string;

  /** Optional system prompt shard from the bundle definition, appended to the base prompt. */
  systemPrompt?: string;

  /** Tags for categorising/organising bundles. */
  tags?: string[];

  /** Flattened tool definitions: built-in + plugins + MCP, deduplicated. */
  tools: ToolDefinition[];

  /** Pre-computed system prompt shards (core + workspace + plugins + skills). */
  promptShards: PromptShard[];

  /** Skills filtered by the bundle's allow-list (for load_skill tool). */
  skills: Skill[];

  /** Plugin manager — still needed for hooks/events/handlers at runtime. */
  pluginManager: PluginManager;

  /** MCP manager — still needed for tool dispatch at runtime. */
  mcpManager?: McpManager;

  /** Workspace instructions (AGENTS.md, CLAUDE.md). */
  workspaceInstructions: string[];
}
