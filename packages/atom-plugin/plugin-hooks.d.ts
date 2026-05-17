import { PluginEventName } from "./constants";
import type { AgentMessage, AgentRunResult, InputEvent, Message, ToolCall, ToolResultMessage, UserMessagePart } from "./sdk-types";
import type { PanelHandle, PluginPanel, PluginPanelState } from "./plugin-ui";
import type { PluginRunsCapability, PluginRuntimeEvent, PluginSessionEvent, PluginSessionRuntime, PluginSessionSummary } from "./plugin-runtime";
export interface PluginAgentContext {
    getMessages(): Message[];
    getSessionEvents(): PluginSessionEvent[];
    setMessages(messages: Message[]): void;
    overrideSession(): void;
    overrideSessionEvents(events: PluginSessionEvent[]): void;
    getSessionKey(): string | undefined;
    getWorkspaceRoot(): string;
    emit(event: PluginRuntimeEventDefinition, payload?: Record<string, unknown>): void;
    getActiveModelId(): string | undefined;
    getActiveSystemPrompt(): string | undefined;
    runs: PluginRunsCapability<"models" | "sessions">;
}
export interface PluginEventDefinitionBase {
    type: string;
    description: string;
}
export interface PluginInputEventDefinition extends PluginEventDefinitionBase {
    handle(context: PluginAgentContext, event: InputEvent): Promise<boolean | void> | boolean | void;
}
export interface PluginRuntimeEventDefinition extends PluginEventDefinitionBase {
    replay?: boolean;
}
export interface PluginCoreEventDefinition<K extends keyof PluginEventMap = keyof PluginEventMap> extends PluginEventDefinitionBase {
    type: K;
    handle(data: PluginEventMap[K]): void | Promise<void>;
}
export declare enum AgentHookName {
    BeforeRun = "before-run",
    AfterRun = "after-run",
    BeforeModelCall = "before-model-call",
    AfterModelCall = "after-model-call",
    BeforeToolCall = "before-tool-call",
    AfterToolCall = "after-tool-call"
}
export type AgentHookMap = {
    [AgentHookName.BeforeRun]: (context: PluginAgentContext, input: UserMessagePart[]) => Promise<void> | void;
    [AgentHookName.AfterRun]: (context: PluginAgentContext, result: AgentRunResult) => Promise<void> | void;
    [AgentHookName.BeforeModelCall]: (context: PluginAgentContext) => Promise<void> | void;
    [AgentHookName.AfterModelCall]: (context: PluginAgentContext, message: AgentMessage) => Promise<void> | void;
    [AgentHookName.BeforeToolCall]: (context: PluginAgentContext, toolCall: ToolCall) => Promise<void> | void;
    [AgentHookName.AfterToolCall]: (context: PluginAgentContext, toolCall: ToolCall, result: ToolResultMessage) => Promise<void> | void;
};
export interface PluginAgentHookDefinition<K extends AgentHookName = AgentHookName> {
    name: K;
    description: string;
    handle: AgentHookMap[K];
}
export interface PluginComputedManifest {
    inputEvents: PluginInputEventMetadata[];
    runtimeEvents: PluginRuntimeEventMetadata[];
    coreEvents: PluginCoreEventMetadata[];
    agentHooks: PluginAgentHookMetadata[];
}
export interface PluginInputEventMetadata extends PluginEventDefinitionBase {
}
export interface PluginRuntimeEventMetadata extends PluginEventDefinitionBase {
    replay?: boolean;
}
export interface PluginCoreEventMetadata extends PluginEventDefinitionBase {
}
export interface PluginAgentHookMetadata {
    name: AgentHookName;
    description: string;
}
export interface PluginHooksCapability {
    onEvent<K extends keyof PluginEventMap>(definition: PluginCoreEventDefinition<K>): PluginCoreEventDefinition<K>;
    registerHook<K extends AgentHookName>(definition: PluginAgentHookDefinition<K>): PluginAgentHookDefinition<K>;
}
export interface PluginEventsCapability {
    registerInputHandler(definition: PluginInputEventDefinition): PluginInputEventDefinition;
    registerRuntimeEvent(definition: PluginRuntimeEventDefinition): PluginRuntimeEventDefinition;
}
export interface PluginPanelsCapability {
    get(id: string): PanelHandle;
}
export type PluginEventMap = {
    [PluginEventName.RunStart]: {
        input: string;
    };
    [PluginEventName.RunEnd]: {
        result: AgentRunResult;
    };
    [PluginEventName.MessageStart]: {
        message: AgentMessage;
    };
    [PluginEventName.MessageEnd]: {
        message: AgentMessage;
    };
    [PluginEventName.ToolRunStart]: {
        toolCall: ToolCall;
    };
    [PluginEventName.ToolRunEnd]: {
        toolCall: ToolCall;
        result: ToolResultMessage;
    };
};
export interface PluginSetupContext {
    hooks: PluginHooksCapability;
    panels: PluginPanelsCapability;
    events: PluginEventsCapability;
}
export type { InputEvent, PluginPanel, PluginPanelState, PluginRuntimeEvent, PluginSessionEvent, PluginSessionRuntime, PluginSessionSummary };
