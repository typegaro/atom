import { existsSync } from "node:fs";
import type { BuiltInTool } from "./types";
import { EDIT_TOOL_DESCRIPTION } from "./descriptions";
import { expectNullableString, expectString, resolveWorkspacePath } from "../tool-runtime-args";

export const editTool: BuiltInTool = {
  definition: {
    name: "edit",
    description: EDIT_TOOL_DESCRIPTION,
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
  async run(arguments_, context) {
    const path = resolveWorkspacePath(context.workspaceRoot, expectString(arguments_.path, "path"));
    const oldText = expectString(arguments_.oldText, "oldText");
    const newText = expectNullableString(arguments_.newText, "newText");
    return await replaceExactTextInFile(path, oldText, newText);
  }
};

async function replaceExactTextInFile(path: string, oldText: string, newText: string): Promise<string> {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const content = await Bun.file(path).text();

  if (!content.includes(oldText)) {
    throw new Error(`Could not find the exact oldText in ${path}`);
  }

  const occurrences = content.split(oldText).length - 1;

  if (occurrences > 1) {
    throw new Error(`Found ${occurrences} occurrences of oldText in ${path}; make it more specific`);
  }

  const nextContent = content.replace(oldText, newText);

  if (nextContent === content) {
    throw new Error(`No changes made to ${path}`);
  }

  await Bun.write(path, nextContent);
  return `Edited ${path}: replaced ${oldText.length} chars with ${newText.length} chars`;
}
