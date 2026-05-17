import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ContentPartType, MessageRole } from "atom-ai";
import { AtomConfigPath, getConfigPaths, SessionEventType } from "@typegaro/atom-types";
import { generateSessionTitle, type SessionEvent, type SessionSummary } from "atom-agent";

export type { SessionEvent, SessionSummary };

const SESSION_HEADER_BYTES = 4096;

// Session listing only reads the first chunk of each JSONL file because the UI
// only needs enough data to recover metadata and a fallback title. Full replay
// is deferred until a session is actually opened.

function parseJsonl(content: string): SessionEvent[] {
  return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as SessionEvent);
}

function readSessionHeader(filePath: string): SessionEvent[] {
  let fd: number;
  try {
    fd = openSync(filePath, "r");
  } catch {
    return [];
  }
  try {
    const buffer = Buffer.alloc(SESSION_HEADER_BYTES);
    const bytesRead = readSync(fd, buffer, 0, SESSION_HEADER_BYTES, 0);
    const content = buffer.subarray(0, bytesRead).toString("utf8");
    const lastNewline = content.lastIndexOf("\n");
    return parseJsonl(lastNewline >= 0 ? content.slice(0, lastNewline) : content);
  } catch {
    return [];
  } finally {
    closeSync(fd);
  }
}

// Returns lightweight session summaries sorted newest-first without loading the
// entire transcript for every session on disk.
export function listSessions(cwd = process.cwd()): SessionSummary[] {
  const dir = resolve(getConfigPaths(cwd).configDir, AtomConfigPath.SessionsDir);

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".jsonl"))
    .sort((a, b) => b.localeCompare(a))
    .map((entry) => {
      const filePath = resolve(dir, entry);
      const id = basename(entry, ".jsonl");
      const events = readSessionHeader(filePath);
      const sessionEvent = events.find((e): e is Extract<SessionEvent, { type: SessionEventType.Session }> => e.type === SessionEventType.Session);
      const titleEvent = events.find((e): e is Extract<SessionEvent, { type: SessionEventType.TitleChange }> => e.type === SessionEventType.TitleChange);
      const timestamp = sessionEvent?.timestamp ?? entry.split("_")[0] ?? entry;
      const title = titleEvent?.title ?? generateSessionTitle(firstUserText(events) ?? id);
      return { id, timestamp, filePath, title };
    });
}

// Loads the full append-only event log for one stored session.
export function loadSessionEvents(filePath: string): SessionEvent[] {
  if (!existsSync(filePath)) {
    return [];
  }

  return parseJsonl(readFileSync(filePath, "utf8"));
}

export function deleteSessionFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  rmSync(filePath, { force: true });
  return true;
}

function firstUserText(events: SessionEvent[]): string | undefined {
  const event = events.find((e): e is Extract<SessionEvent, { type: SessionEventType.Message }> =>
    e.type === SessionEventType.Message && e.message?.role === MessageRole.User
  );

  if (!event) {
    return undefined;
  }

  const text = event.message.content
    .filter((p): p is { type: ContentPartType.Text; text: string } => p.type === ContentPartType.Text)
    .map((p) => p.text)
    .join(" ");

  return text || undefined;
}
