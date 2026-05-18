import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BuiltInTool } from "./types";
import { GREP_TOOL_DESCRIPTION } from "./descriptions";
import { expectString } from "../tool-runtime-args";
const MAX_LINE_LENGTH = 2000;
const RESULT_LIMIT = 100;

export const grepTool: BuiltInTool = {
  definition: {
    name: "grep",
    description: GREP_TOOL_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The regex pattern to search for in file contents" },
        path: { type: "string", description: "The directory to search in. Defaults to the current working directory." },
        include: { type: "string", description: "File pattern to include in the search (e.g. \"*.js\", \"*.{ts,tsx}\")" }
      },
      required: ["pattern"]
    }
  },
  async run(arguments_, context) {
    const pattern = expectString(arguments_.pattern, "pattern");
    const location = resolveSearchLocation(context.workspaceRoot, arguments_.path);
    const command = [
      "rg",
      "--line-number",
      "--with-filename",
      "--no-heading",
      "--color",
      "never"
    ];

    if (typeof arguments_.include === "string" && arguments_.include.length > 0) {
      command.push("--glob", arguments_.include);
    }

    command.push(pattern);

    if (location.file) {
      command.push(location.file);
    } else {
      command.push(".");
    }

    const proc = Bun.spawn(command, {
      cwd: location.cwd,
      stdout: "pipe",
      stderr: "pipe"
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);

    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(stderr.trim() || `grep command failed with exit code ${exitCode}`);
    }

    const rows = stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map(parseMatch)
      .filter((row): row is MatchRow => Boolean(row))
      .map((row) => ({
        ...row,
        path: resolve(location.cwd, row.path)
      }));

    if (rows.length === 0) {
      return "No files found";
    }

    const mtimes = new Map<string, number>();

    for (const filePath of new Set(rows.map((row) => row.path))) {
      try {
        const info = statSync(filePath);
        if (info.isFile()) {
          mtimes.set(filePath, info.mtimeMs);
        }
      } catch {
        continue;
      }
    }

    const matches = rows
      .filter((row) => mtimes.has(row.path))
      .map((row) => ({ ...row, mtime: mtimes.get(row.path) ?? 0 }))
      .sort((a, b) => b.mtime - a.mtime);

    if (matches.length === 0) {
      return "No files found";
    }

    const truncated = matches.length > RESULT_LIMIT;
    const finalMatches = truncated ? matches.slice(0, RESULT_LIMIT) : matches;
    const output = [`Found ${matches.length} matches${truncated ? ` (showing first ${RESULT_LIMIT})` : ""}`];
    let currentPath = "";

    for (const match of finalMatches) {
      if (currentPath !== match.path) {
        if (currentPath) {
          output.push("");
        }

        currentPath = match.path;
        output.push(`${match.path}:`);
      }

      const text = match.text.length > MAX_LINE_LENGTH
        ? `${match.text.slice(0, MAX_LINE_LENGTH)}...`
        : match.text;
      output.push(`  Line ${match.line}: ${text}`);
    }

    if (truncated) {
      output.push("", `(Results truncated: showing ${RESULT_LIMIT} of ${matches.length} matches (${matches.length - RESULT_LIMIT} hidden). Consider using a more specific path or pattern.)`);
    }

    return output.join("\n");
  }
};

interface SearchLocation {
  cwd: string;
  file?: string;
}

interface MatchRow {
  path: string;
  line: number;
  text: string;
}

function resolveSearchLocation(workspaceRoot: string, pathValue: unknown): SearchLocation {
  const search = pathValue === undefined
    ? workspaceRoot
    : resolve(workspaceRoot, expectString(pathValue, "path"));

  if (!existsSync(search)) {
    throw new Error(`Path not found: ${search}`);
  }

  const info = statSync(search);

  if (info.isDirectory()) {
    return { cwd: search };
  }

  if (!info.isFile()) {
    throw new Error(`Path is neither a file nor a directory: ${search}`);
  }

  return {
    cwd: dirname(search),
    file: search
  };
}

function parseMatch(line: string): MatchRow | undefined {
  const match = /^(.*?):(\d+):(.*)$/.exec(line);

  if (!match) {
    return undefined;
  }

  const [, path, lineNumber, text] = match;
  return {
    path,
    line: Number(lineNumber),
    text
  };
}
