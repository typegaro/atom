import type { BuiltInTool } from "./types";
import { BASH_TOOL_DESCRIPTION } from "./descriptions";
import { expectString } from "../tool-runtime-args";

export const bashTool: BuiltInTool = {
  definition: {
    name: "bash",
    description: BASH_TOOL_DESCRIPTION,
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
