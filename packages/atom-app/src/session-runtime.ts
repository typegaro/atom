import type { Usage, UserMessagePart } from "atom-ai";
import type { PromptShard } from "atom-agent";
import type {
  InputEvent,
  PluginRuntimeEvent,
  PluginSessionOptions,
  PluginSessionRuntime,
  PluginSessionSummary,
  PluginSessionEvent
} from "@typegaro/atom-plugin";
import { AtomAppController } from "./controller";

type SessionListener = (event: PluginRuntimeEvent) => void | Promise<void>;

export interface AtomAppSessionRuntimeOptions {
  controller: AtomAppController;
  ready: Promise<void>;
  dispose: () => void;
}

// AtomAppSessionRuntime exposes a detached run channel over one controller.
//
// Callers can enqueue inputs and subscribe to runtime events without owning the
// controller directly. The small internal queue keeps runs serialized so one
// session behaves like a single conversation stream.
export class AtomAppSessionRuntime implements PluginSessionRuntime<"models" | "sessions"> {
  private readonly listeners = new Set<SessionListener>();
  private readonly queue: Array<{ runId: string; input: string | UserMessagePart[] | InputEvent }> = [];
  private readonly controller: AtomAppController;
  private readonly readyPromise: Promise<void>;
  private readonly dispose: () => void;
  private draining = false;
  private closed = false;

  constructor(options: AtomAppSessionRuntimeOptions) {
    this.controller = options.controller;
    this.readyPromise = options.ready;
    this.dispose = options.dispose;
  }

  async submit(input: string | UserMessagePart[] | InputEvent): Promise<{ runId: string }> {
    if (this.closed) {
      throw new Error("Cannot submit to a closed session");
    }

    const runId = crypto.randomUUID();
    this.queue.push({ runId, input });
    void this.flushQueue();
    return { runId };
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  interrupt(): void {
    this.controller.interrupt();
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.queue.length = 0;
    this.listeners.clear();
    this.interrupt();
    this.dispose();
  }

  getTotalUsage(): Usage {
    return this.controller.getTotalUsage();
  }

  switchModel(modelId: string): Promise<void> {
    return this.controller.switchModel(modelId);
  }

  supportsImages(): boolean {
    return this.controller.supportsImages();
  }

  getActiveModelId(): string | undefined {
    return this.controller.getActiveModelId();
  }

  listModels(): Array<{ id: string }> {
    return this.controller.listModels();
  }

  listSessions(): PluginSessionSummary[] {
    return this.controller.listSessions();
  }

  loadSession(sessionId: string): PluginSessionEvent[] {
    return this.controller.loadSession(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.controller.deleteSession(sessionId);
  }

  resetSession(): Promise<void> {
    return this.controller.resetConversation();
  }

  getActiveSystemPrompt(): string | undefined {
    return this.controller.getActiveSystemPrompt();
  }

  getActiveSystemPromptShards(): PromptShard[] {
    return this.controller.getActiveSystemPromptShards();
  }

  getActiveBundleName(): string | undefined {
    return this.controller.getActiveBundleName();
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  private async flushQueue(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      await this.readyPromise;

      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) {
          continue;
        }

        for await (const event of this.controller.submit(next.input)) {
          this.emit({ ...event, runId: next.runId });
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private emit(event: PluginRuntimeEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result && typeof result === "object" && "then" in result) {
          void result.catch((error: unknown) => {
            console.error(error);
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
  }
}
