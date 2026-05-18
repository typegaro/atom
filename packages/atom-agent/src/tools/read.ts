import { createReadStream, existsSync, statSync } from "node:fs";
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { BuiltInTool } from "./types";
import { READ_TOOL_DESCRIPTION } from "./descriptions";
import { expectRequiredPositiveInteger, expectString, resolveWorkspacePath } from "../tool-runtime-args";

const READ_SAMPLE_BYTES = 4096;

export const readTool: BuiltInTool = {
  definition: {
    name: "read",
    description: READ_TOOL_DESCRIPTION,
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
  async run(arguments_, context) {
    const path = resolveWorkspacePath(context.workspaceRoot, expectString(arguments_.filePath, "filePath"));
    const offset = expectRequiredPositiveInteger(arguments_.offset, "offset");
    const limit = expectRequiredPositiveInteger(arguments_.limit, "limit");
    return await readTextFileRange(path, { offset, limit });
  }
};

async function readTextFileRange(
  path: string,
  options: { offset: number; limit: number }
): Promise<string> {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const stat = statSync(path);

  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${path}`);
  }

  if (await isBinaryFile(path, stat.size)) {
    throw new Error(`Cannot read non-text file: ${path}`);
  }

  const result = await readLines(path, options);

  if (result.lineCount < options.offset && !(result.lineCount === 0 && options.offset === 1)) {
    throw new Error(`Offset ${options.offset} is out of range for ${path} (${result.lineCount} lines)`);
  }

  const lines = result.lines.map((line, index) => `${options.offset + index}: ${line}`);
  const summary = result.hasMore
    ? `\n\n(Showing lines ${options.offset}-${options.offset + result.lines.length - 1}. Use offset=${options.offset + result.lines.length} to continue.)`
    : `\n\n(End of file - total ${result.lineCount} lines)`;

  return lines.join("\n") + summary;
}

async function isBinaryFile(path: string, fileSize: number): Promise<boolean> {
  if (fileSize === 0) {
    return false;
  }

  const file = await open(path, "r");

  try {
    const sampleLength = Math.min(READ_SAMPLE_BYTES, fileSize);
    const buffer = Buffer.alloc(sampleLength);
    const { bytesRead } = await file.read(buffer, 0, sampleLength, 0);
    const sample = buffer.subarray(0, bytesRead);
    let nonPrintableCount = 0;

    for (const byte of sample) {
      if (byte === 0) {
        return true;
      }

      if (byte < 9 || (byte > 13 && byte < 32)) {
        nonPrintableCount += 1;
      }
    }

    return sample.length > 0 && nonPrintableCount / sample.length > 0.3;
  } finally {
    await file.close();
  }
}

async function readLines(
  path: string,
  options: { offset: number; limit: number }
): Promise<{ lines: string[]; lineCount: number; hasMore: boolean }> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const readline = createInterface({ input: stream, crlfDelay: Infinity });
  const startLine = options.offset - 1;
  const lines: string[] = [];
  let lineCount = 0;
  let hasMore = false;

  try {
    for await (const line of readline) {
      lineCount += 1;

      if (lineCount <= startLine) {
        continue;
      }

      if (lines.length >= options.limit) {
        hasMore = true;
        break;
      }

      lines.push(line);
    }
  } finally {
    readline.close();
    stream.destroy();
  }

  return { lines, lineCount, hasMore };
}
