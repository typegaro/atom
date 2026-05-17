import type { Message } from "./message";
import type { ToolDefinition } from "./tool";

export interface Context {
  system?: string;
  messages: Message[];
  tools?: ToolDefinition[];
}
