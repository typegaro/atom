import type { AgentRuntime, ModelSelection } from "atom-ai";
import { AGENT_VERSION } from "./env";
import { SessionEventType } from "@typegaro/atom-types";
import { AtomAgent, type AtomAgentOptions } from "./agent";
import type { PromptShard } from "atom-bundle";
import type { Skill, SkillSource } from "atom-bundle";
import { AgentContext, type AgentContextOptions, type AgentContextSnapshot } from "./context";
import { generateSessionTitle, type SessionEvent, type SessionSummary } from "./session-writer";

export { AGENT_VERSION, AgentContext, AtomAgent, generateSessionTitle, SessionEventType };
export type {
  AgentRuntime,
  ModelSelection,
  AtomAgentOptions,
  AgentContextOptions,
  AgentContextSnapshot,
  SessionEvent,
  SessionSummary,
  PromptShard,
  Skill,
  SkillSource
};

export interface AgentConfig {
  name: string;
  activeModel: string;
  provider: string;
  version: string;
}

export function createAgentConfig(name: string, runtime: AgentRuntime, version = AGENT_VERSION): AgentConfig {
  return {
    name,
    activeModel: runtime.model.id,
    provider: runtime.provider,
    version
  };
}
