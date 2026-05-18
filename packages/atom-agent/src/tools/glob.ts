import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { BuiltInTool } from "./types";
import { GLOB_TOOL_DESCRIPTION } from "./descriptions";
import { expectString } from "../tool-runtime-args";
const RESULT_LIMIT = 100;

export const globTool: BuiltInTool = {
  definition: {
    name: "glob",
    description: GLOB_TOOL_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The glob pattern to match files against" },
        path: {
          type: "string",
          description: "The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter \"undefined\" or \"null\" - simply omit it for the default behavior. Must be a valid directory path if provided."
        }
      },
      required: ["pattern"]
    }
  },
  async run(arguments_, context) {
    const pattern = expectString(arguments_.pattern, "pattern");
    const search = resolveSearchDirectory(context.workspaceRoot, arguments_.path);
    const command = ["rg", "--files", "-g", pattern];
    const proc = Bun.spawn(command, {
      cwd: search,
      stdout: "pipe",
      stderr: "pipe"
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);

    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(stderr.trim() || `glob command failed with exit code ${exitCode}`);
    }

    const files = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((file) => {
        const fullPath = resolve(search, file);
        let mtime = 0;

        try {
          mtime = statSync(fullPath).mtimeMs;
        } catch {
          mtime = 0;
        }

        return { path: fullPath, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    const truncated = files.length > RESULT_LIMIT;
    const finalFiles = truncated ? files.slice(0, RESULT_LIMIT) : files;

    if (finalFiles.length === 0) {
      return "No files found";
    }

    const output = finalFiles.map((file) => file.path);

    if (truncated) {
      output.push("", `(Results are truncated: showing first ${RESULT_LIMIT} results. Consider using a more specific path or pattern.)`);
    }

    return output.join("\n");
  }
};

function resolveSearchDirectory(workspaceRoot: string, pathValue: unknown): string {
  if (pathValue === undefined) {
    return workspaceRoot;
  }

  const rawPath = expectString(pathValue, "path");
  const search = resolve(workspaceRoot, rawPath);

  if (!existsSync(search)) {
    throw new Error(`Path not found: ${search}`);
  }

  const info = statSync(search);

  if (!info.isDirectory()) {
    throw new Error(`glob path must be a directory: ${search}`);
  }

  return search;
}
