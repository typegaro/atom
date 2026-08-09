import type { Command } from "commander";
import type { AtomConfigPaths } from "@typegaro/atom-types";
import type { InputEvent, Message, RuntimeEvent, Usage, UserMessagePart } from "./sdk-types";

// The runtime interfaces expose the smallest host surface plugin code needs:
// create or subscribe to runs, inspect models and sessions when allowed, and
// discover config paths. Concrete app classes stay behind these contracts.

export interface PluginControllerOptions {
  modelId?: string;
  provider?: string;
  includeMcp?: boolean;
  storeSession?: boolean;
}

export interface PluginSessionSummary {
  id: string;
  timestamp: string;
  title: string;
}

export type PluginSessionEvent =
  | { type: "session"; version: number; id: string; timestamp: string; cwd: string }
  | { type: "title_change"; id: string; timestamp: string; title: string }
  | { type: "model_change"; id: string; timestamp: string; modelId: string }
  | { type: "message"; id: string; timestamp: string; message: Message; turnId?: string }
  | { type: "interrupt"; id: string; timestamp: string; turnId?: string }
  | { type: "runtime_event"; id: string; timestamp: string; turnId: string; event: RuntimeEvent };

export type PluginRunEvent = RuntimeEvent;
export type PluginRuntimeEvent = { runId: string } & PluginRunEvent;

// A controller represents a direct, synchronous integration point: callers can
// start runs and await or stream the results from the same call site.
export interface PluginRunController {
  initialize(): Promise<void>;
  submit(input: string | UserMessagePart[] | InputEvent): AsyncGenerator<PluginRunEvent>;
  send(input: string | UserMessagePart[]): Promise<{ thinkingText: string; assistantText: string }>;
  interrupt(): void;
  getTotalUsage(): Usage;
  getActiveBundleName(): string | undefined;
}

export interface PluginModelController {
  switchModel(modelId: string): Promise<void>;
  getActiveModelId(): string | undefined;
  listModels(): Array<{ id: string }>;
}

export interface PluginSessionController {
  listSessions(): PluginSessionSummary[];
  loadSession(sessionId: string): PluginSessionEvent[];
  deleteSession(sessionId: string): boolean;
  resetSession(): Promise<void>;
}

export type PluginCapabilityName = "config" | "hooks" | "models" | "panels" | "runs" | "sessions";
export type PluginControllerCapabilities = Extract<PluginCapabilityName, "models" | "sessions">;

export type PluginControllerFor<Capabilities extends PluginControllerCapabilities = never> = PluginRunController
  & ("models" extends Capabilities ? PluginModelController : {})
  & ("sessions" extends Capabilities ? PluginSessionController : {});

export interface PluginRunsCapability<Capabilities extends PluginControllerCapabilities = never> {
  createController(options?: PluginControllerOptions): PluginControllerFor<Capabilities>;
}

export interface PluginSessionOptions extends PluginControllerOptions {
  key?: string;
  sessionId?: string;
  /** Named bundle from bundles.json to control which plugins, MCP servers, and
   *  skills are available in this session's agent. Defaults to the runtime's
   *  configured bundle (or "default" if none is configured). */
  bundleName?: string;
}

/** Summary of a bundle's metadata, exposed to plugins without leaking internal types. */
export interface PluginBundleSummary {
  name: string;
  model?: string;
  systemPrompt?: string;
  tags?: string[];
}

export interface PluginConfigCapability {
  getPaths(): AtomConfigPaths;
}

// Session runtimes model a detached run channel. Callers submit input, receive
// a run id immediately, and then observe events through subscriptions.
export interface PluginSystemPromptShard {
  source: string;
  content: string;
}

export interface PluginSessionRuntimeBase {
  submit(input: string | UserMessagePart[] | InputEvent): Promise<{ runId: string }>;
  subscribe(listener: (event: PluginRuntimeEvent) => void | Promise<void>): () => void;
  interrupt(): void;
  /** Tear down the session and release it. No events are delivered afterwards. */
  close(): void;
  /** Whether the session's active model accepts image input. */
  supportsImages(): boolean;
  getTotalUsage(): Usage;
  getActiveSystemPrompt(): string | undefined;
  getActiveSystemPromptShards(): PluginSystemPromptShard[];
  getActiveBundleName(): string | undefined;
  ready?(): Promise<void>;
}

export type PluginSessionRuntime<Capabilities extends PluginControllerCapabilities = never> = PluginSessionRuntimeBase
  & ("models" extends Capabilities ? PluginModelController : {})
  & ("sessions" extends Capabilities ? PluginSessionController : {});

export interface PluginRuntimeCapability<Capabilities extends PluginControllerCapabilities = never> {
  openSession(options?: PluginSessionOptions): PluginSessionRuntime<Capabilities>;
  /** List all available bundle names. */
  listBundles(): string[];
  /** Get metadata for a named bundle, or undefined if it doesn't exist. */
  getBundle(name: string): PluginBundleSummary | undefined;
}

export interface PluginRuntimeContext<Capabilities extends PluginControllerCapabilities = never> {
  runtime: PluginRuntimeCapability<Capabilities>;
  config: PluginConfigCapability;
}

export interface PluginCliCommand {
  register(program: Command, context: PluginRuntimeContext): void | Promise<void>;
}

export interface PluginChannel {
  id: string;
  start(context: PluginRuntimeContext): Promise<void> | void;
}

export interface PluginBackground {
  id: string;
  autoStart?: boolean;
  start(context: PluginRuntimeContext): Promise<void> | void;
}
