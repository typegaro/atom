import type { AgentMessage } from "../types/message";
import type { Usage } from "../types/usage";

export function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function mapStopReason(reason: string | null | undefined, hasToolCalls = false): AgentMessage["stopReason"] {
  if (hasToolCalls || reason === "tool_calls") {
    return "tool-use";
  }

  if (reason === "length") {
    return "length";
  }

  return "stop";
}

export interface TokenUsageLike {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export function normalizeUsage(usage: TokenUsageLike | undefined): Usage | undefined {
  if (!usage) {
    return undefined;
  }

  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? usage.completion_tokens ?? usage.output_tokens ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens ?? usage.total_tokens ?? inputTokens + outputTokens
  };
}
