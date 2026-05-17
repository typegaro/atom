import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AtomConfigPath, getConfigPaths } from "@typegaro/atom-types";
import { MessageRole } from "atom-ai";
import type { Message } from "atom-ai";
import { SessionEventType, type RuntimeEvent } from "@typegaro/atom-types";

export type SessionEvent =
  | { type: SessionEventType.Session; version: number; id: string; timestamp: string; cwd: string }
  | { type: SessionEventType.TitleChange; id: string; timestamp: string; title: string }
  | { type: SessionEventType.ModelChange; id: string; timestamp: string; modelId: string }
  | { type: SessionEventType.Message; id: string; timestamp: string; message: Message; turnId?: string }
  | { type: SessionEventType.Interrupt; id: string; timestamp: string; turnId?: string }
  | { type: SessionEventType.RuntimeEvent; id: string; timestamp: string; turnId: string; event: RuntimeEvent };

export interface SessionSummary {
  id: string;
  timestamp: string;
  filePath: string;
  title: string;
}

function loadSessionEvents(filePath: string): SessionEvent[] {
  if (!existsSync(filePath)) {
    return [];
  }

  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEvent);
}

export function generateSessionTitle(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();

  if (singleLine.length <= 48) {
    return singleLine;
  }

  return `${singleLine.slice(0, 45).trimEnd()}...`;
}

function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function sessionEventId(): string {
  return crypto.randomUUID();
}

// SessionWriter persists conversation state as an append-only event log.
//
// It delays file creation until the first real user message so empty or aborted
// setup work does not leave junk sessions behind, then batches per-turn writes
// to keep the on-disk transcript aligned with user-visible conversation turns.
export class SessionWriter {
  private sessionId?: string;
  private sessionFilePath?: string;
  private readonly pendingEvents: SessionEvent[] = [];
  private readonly turnBuffer: SessionEvent[] = [];
  private currentTurnId?: string;
  private readonly cwd: string;
  private readonly workspaceRoot: string;

  constructor(options: { cwd: string; workspaceRoot: string }) {
    this.cwd = options.cwd;
    this.workspaceRoot = options.workspaceRoot;
  }

  bufferMessage(message: Message): void {
    this.turnBuffer.push({
      type: SessionEventType.Message,
      id: sessionEventId(),
      timestamp: new Date().toISOString(),
      message,
      turnId: this.ensureTurnId()
    });
  }

  bufferRuntimeEvent(event: RuntimeEvent): void {
    this.turnBuffer.push({
      type: SessionEventType.RuntimeEvent,
      id: sessionEventId(),
      timestamp: new Date().toISOString(),
      turnId: this.ensureTurnId(),
      event
    });
  }

  flushTurn(): void {
    if (this.turnBuffer.length === 0) {
      return;
    }

    const buffered = this.turnBuffer.splice(0);
    this.currentTurnId = undefined;

    for (const event of buffered) {
      this.write(event);
    }
  }

  override(messages: Message[]): void {
    if (!this.sessionFilePath || !this.sessionId) {
      return;
    }

    this.turnBuffer.length = 0;
    this.currentTurnId = undefined;

    const lines = [
      JSON.stringify({ type: SessionEventType.Session, version: 2, id: this.sessionId, timestamp: new Date().toISOString(), cwd: this.cwd } satisfies SessionEvent),
      ...messages.map((message) => JSON.stringify({
        type: SessionEventType.Message,
        id: sessionEventId(),
        timestamp: new Date().toISOString(),
        message,
        turnId: sessionEventId()
      } satisfies SessionEvent))
    ];

    writeFileSync(this.sessionFilePath, `${lines.join("\n")}\n`);
  }

  overrideEvents(events: SessionEvent[]): void {
    if (!this.sessionFilePath || !this.sessionId) {
      return;
    }

    this.turnBuffer.length = 0;
    this.currentTurnId = undefined;

    const normalized = events.filter((event) => event.type !== SessionEventType.Session);
    const lines = [
      JSON.stringify({ type: SessionEventType.Session, version: 2, id: this.sessionId, timestamp: new Date().toISOString(), cwd: this.cwd } satisfies SessionEvent),
      ...normalized.map((event) => JSON.stringify(event))
    ];

    writeFileSync(this.sessionFilePath, `${lines.join("\n")}\n`);
  }

  recordModelChange(modelId: string): void {
    this.write({ type: SessionEventType.ModelChange, id: sessionEventId(), timestamp: new Date().toISOString(), modelId });
  }

  recordInterrupt(): void {
    this.flushTurn();
    this.write({
      type: SessionEventType.Interrupt,
      id: sessionEventId(),
      timestamp: new Date().toISOString(),
      turnId: this.currentTurnId
    });
  }

  restore(filePath: string, sessionId: string): void {
    this.sessionFilePath = filePath;
    this.sessionId = sessionId;
    this.turnBuffer.length = 0;
    this.currentTurnId = undefined;
  }

  reset(): void {
    this.sessionId = undefined;
    this.sessionFilePath = undefined;
    this.pendingEvents.length = 0;
    this.turnBuffer.length = 0;
    this.currentTurnId = undefined;
  }

  getEvents(): SessionEvent[] {
    if (!this.sessionFilePath || !this.sessionId) {
      return [];
    }

    return loadSessionEvents(this.sessionFilePath);
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  getSessionFilePath(): string | undefined {
    return this.sessionFilePath;
  }

  private write(event: SessionEvent): void {
    if (!this.sessionFilePath) {
      const isFirstUserMessage = event.type === SessionEventType.Message && event.message.role === MessageRole.User;

      if (!isFirstUserMessage) {
        this.pendingEvents.push(event);
        return;
      }

      const dir = resolve(getConfigPaths(this.workspaceRoot).configDir, AtomConfigPath.SessionsDir);
      mkdirSync(dir, { recursive: true });
      this.sessionId = sessionEventId();
      this.sessionFilePath = resolve(dir, `${timestampForFile()}_${this.sessionId}.jsonl`);

      appendFileSync(this.sessionFilePath, `${JSON.stringify({
        type: SessionEventType.Session,
        version: 2,
        id: this.sessionId,
        timestamp: new Date().toISOString(),
        cwd: this.cwd
      } satisfies SessionEvent)}\n`);

      for (const pendingEvent of this.pendingEvents) {
        appendFileSync(this.sessionFilePath, `${JSON.stringify(pendingEvent)}\n`);
      }

      this.pendingEvents.length = 0;
    }

    appendFileSync(this.sessionFilePath, `${JSON.stringify(event)}\n`);
  }

  private ensureTurnId(): string {
    this.currentTurnId ??= sessionEventId();
    return this.currentTurnId;
  }
}
