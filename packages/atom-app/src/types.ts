import { ContentPartType, type UserMessagePart } from "atom-ai";
import type { InputEvent } from "@typegaro/atom-types";

export type AppUserInput = string | UserMessagePart[] | InputEvent;

export function isInputEvent(input: AppUserInput): input is InputEvent {
  return typeof input === "object"
    && !Array.isArray(input)
    && input !== null
    && "type" in input
    && typeof input.type === "string";
}

export function normalizeAppUserInput(input: AppUserInput): UserMessagePart[] {
  if (typeof input === "string") {
    return [{ type: ContentPartType.Text, text: input }];
  }

  return Array.isArray(input) ? [...input] : [];
}

export interface AppSendResult {
  thinkingText: string;
  assistantText: string;
}
