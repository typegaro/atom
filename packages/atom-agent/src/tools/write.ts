import { readFileSync } from "node:fs";
import type { BuiltInTool } from "./types";
import { expectString, resolveWorkspacePath } from "../tool-runtime-args";

const DESCRIPTION = readFileSync(new URL("./prompts/write.txt", import.meta.url), "utf8").trim();

export const writeTool: BuiltInTool = {
  definition: {
    name: "write",
    description: DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        content: { type: "string", description: "Text content to write" }
      },
      required: ["path", "content"]
    }
  },
  async run(arguments_, context) {
    const path = resolveWorkspacePath(context.workspaceRoot, expectString(arguments_.path, "path"));
    const content = expectString(arguments_.content, "content");
    await Bun.write(path, content);
    return `Wrote ${content.length} characters to ${path}`;
  }
};
