export enum RuntimeEventType {
  MessageStart = "message-start",
  TextDelta = "text-delta",
  ThinkingDelta = "thinking-delta",
  ToolRunStart = "tool-run-start",
  ToolRunEnd = "tool-run-end",
  FileEdit = "file-edit",
  Interrupted = "interrupted",
  Error = "error",
  Done = "done",
  SessionRefresh = "session-refresh",
  BundleReload = "bundle-reload"
}

export enum SessionEventType {
  Session = "session",
  TitleChange = "title_change",
  ModelChange = "model_change",
  Message = "message",
  Interrupt = "interrupt",
  RuntimeEvent = "runtime_event"
}

export interface InputEvent {
  type: string;
  [key: string]: unknown;
}

export interface ExtensionRuntimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface BundleReloadEvent {
  type: RuntimeEventType.BundleReload;
  /** Which bundle to reload. Omit or "default" for the default bundle. */
  bundleName?: string;
  /** What to reload. Defaults to ["bundle"] if omitted. */
  targets?: Array<"plugins" | "mcp" | "skills" | "bundle" | "all">;
}

// RuntimeEvent is the app-facing event contract. It intentionally allows custom
// extension events so plugins can surface extra UI behavior without forcing the
// core package to know every event type ahead of time.
export type RuntimeEvent =
  | { type: RuntimeEventType.MessageStart }
  | { type: RuntimeEventType.TextDelta; delta: string }
  | { type: RuntimeEventType.ThinkingDelta; delta: string }
  | { type: RuntimeEventType.ToolRunStart; id: string; name: string; label: string; arguments?: Record<string, unknown> }
  | { type: RuntimeEventType.ToolRunEnd; id: string; name: string; text: string; isError: boolean }
  | { type: RuntimeEventType.FileEdit; path: string; lines: Array<{ text: string; tone: "success" | "danger" | "muted" }> }
  | { type: RuntimeEventType.Interrupted }
  | { type: RuntimeEventType.Error; error: string }
  | { type: RuntimeEventType.Done }
  | { type: RuntimeEventType.SessionRefresh; sessionId: string }
  | ExtensionRuntimeEvent;
