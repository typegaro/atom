import type { ApiId } from "./ids";

export interface ModelCapabilities {
  tools: boolean;
  streaming: boolean;
  images: boolean;
  reasoning: boolean;
}

export interface ModelRef {
  api: ApiId;
  id: string;
}

export interface ModelDefinition extends ModelRef {
  name: string;
  contextWindow: number;
  maxOutputTokens?: number;
  capabilities: ModelCapabilities;
}
