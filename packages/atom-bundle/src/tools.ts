import type { ToolDefinition } from "atom-ai";
import type { Skill } from "./skills";

// Static tool definitions for the built-in tools that the agent loop provides.
// These are metadata-only (name, description, inputSchema) — the actual run
// implementations live in atom-agent/src/tools/ and are dispatched by
// AgentToolRuntime at runtime.
//
// We keep the definitions here so AgentBundleManager can build the full tool
// list without depending on atom-agent's tool implementations.

const STATIC_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read",
    description: "Read a specific range of lines from a UTF-8 text file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative file path" },
        offset: { type: "number", description: "1-indexed line number to start from. Required." },
        limit: { type: "number", description: "Maximum number of lines to read. Required." }
      },
      required: ["filePath", "offset", "limit"]
    }
  },
  {
    name: "edit",
    description: "Edit an existing UTF-8 text file by replacing one exact text match.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        oldText: { type: "string", description: "Exact text to find and replace" },
        newText: { type: "string", description: "Replacement text" }
      },
      required: ["path", "oldText", "newText"]
    }
  },
  {
    name: "write",
    description: "Write UTF-8 text to a file, replacing its full contents.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        content: { type: "string", description: "Text content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "bash",
    description: "Run a shell command and return the output with its exit code.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run" }
      },
      required: ["command"]
    }
  },
  {
    name: "glob",
    description: "Find files by glob pattern, sorted by modification time.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The glob pattern to match files against" },
        path: { type: "string", description: "The directory to search in" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "grep",
    description: "Search file contents using regular expressions.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The regex pattern to search for in file contents" },
        path: { type: "string", description: "The directory to search in" },
        include: { type: "string", description: "File pattern to include (e.g. *.ts)" }
      },
      required: ["pattern"]
    }
  }
];

const LOAD_SKILL_TOOL_DEFINITION: ToolDefinition = {
  name: "load_skill",
  description: "Load a skill's full content into context. Only use skills listed in <available_skills>.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Exact skill name"
      }
    },
    required: ["name"]
  }
};

export function buildCoreTools(skills: Skill[]): ToolDefinition[] {
  return skills.length === 0
    ? [...STATIC_TOOL_DEFINITIONS]
    : [...STATIC_TOOL_DEFINITIONS, LOAD_SKILL_TOOL_DEFINITION];
}
