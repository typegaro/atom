import { readFileSync } from "node:fs";
import type { BuiltInTool } from "./types";
import { expectString } from "../tool-runtime-args";

const DESCRIPTION = readFileSync(new URL("./prompts/bash.txt", import.meta.url), "utf8").trim();

export const bashTool: BuiltInTool = {
  definition: {
    name: "bash",
    description: DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run" }
      },
      required: ["command"]
    }
  },
  async run(arguments_, context) {
    const command = expectString(arguments_.command, "command");
    const proc = Bun.spawn(["zsh", "-lc", command], {
      cwd: context.workspaceRoot,
      stdout: "pipe",
      stderr: "pipe"
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);

    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    return output ? `exit_code=${exitCode}\n${output}` : `exit_code=${exitCode}`;
  }
};
