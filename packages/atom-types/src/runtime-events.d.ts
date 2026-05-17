export declare enum RuntimeEventType {
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
export declare enum SessionEventType {
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
    bundleName?: string;
    targets?: Array<"plugins" | "mcp" | "skills" | "bundle" | "all">;
}
export type RuntimeEvent = {
    type: RuntimeEventType.MessageStart;
} | {
    type: RuntimeEventType.TextDelta;
    delta: string;
} | {
    type: RuntimeEventType.ThinkingDelta;
    delta: string;
} | {
    type: RuntimeEventType.ToolRunStart;
    id: string;
    name: string;
    label: string;
} | {
    type: RuntimeEventType.ToolRunEnd;
    id: string;
    name: string;
    text: string;
    isError: boolean;
} | {
    type: RuntimeEventType.FileEdit;
    path: string;
    lines: Array<{
        text: string;
        tone: "success" | "danger" | "muted";
    }>;
} | {
    type: RuntimeEventType.Interrupted;
} | {
    type: RuntimeEventType.Error;
    error: string;
} | {
    type: RuntimeEventType.Done;
} | {
    type: RuntimeEventType.SessionRefresh;
    sessionId: string;
} | ExtensionRuntimeEvent;
