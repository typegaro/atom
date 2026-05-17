import type { Context } from "../types/context";
import { ContentPartType } from "../types/content-part";
import { ApiId } from "../types/ids";
import { MessageRole } from "../types/message-role";
import type { AgentMessage } from "../types/message";
import type { ModelDefinition } from "../types/model";
import { Provider, type ProviderConfig, type ProviderModelProfile } from "./base/provider";
import type { ProviderModule } from "./base/provider-module";
import { StreamEventSource, StreamEventType, type ProviderEvent } from "../types/stream";
import { EventStream } from "../utils/event-stream";

function getLastUserText(context: Context): string {
  const userMessages = context.messages.filter((message) => message.role === MessageRole.User);
  const lastMessage = userMessages[userMessages.length - 1];
  if (!lastMessage) {
    return "";
  }

  return lastMessage.content.filter((part) => part.type === ContentPartType.Text).map((part) => part.text).join("\n");
}

// MockProvider is a tiny deterministic provider for tests and smoke paths.
// It echoes the latest user text through the normal streaming contract so the
// rest of the runtime can be exercised without a real external model.
export class MockProvider extends Provider {
  protected override toModelDefinition(config: ProviderConfig): ModelDefinition {
    return {
      ...super.toModelDefinition(config),
      api: ApiId.OpenAICompletions
    };
  }

  protected modelProfile(): ProviderModelProfile {
    return {
      contextWindow: 1024,
      capabilities: {
        tools: false,
        streaming: true,
        images: false,
        reasoning: false
      }
    };
  }

  protected async runStream(
    context: Context,
    stream: EventStream<ProviderEvent, AgentMessage>,
    _signal?: AbortSignal
  ): Promise<AgentMessage> {
    const prompt = getLastUserText(context);
    const text = `mock:${prompt || "hello"}`;
    const message: AgentMessage = {
      role: MessageRole.Assistant,
      api: this.model.api,
      model: this.model.id,
      content: [{ type: ContentPartType.Text, text }],
      stopReason: "stop"
    };

    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageStart, message });
    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.TextDelta, contentIndex: 0, delta: text });
    stream.push({ source: StreamEventSource.Provider, type: StreamEventType.MessageEnd, message });
    return message;
  }
}

export const mockModel: ModelDefinition = {
  id: "mock-model",
  name: "Mock Model",
  api: ApiId.OpenAICompletions,
  contextWindow: 1024,
  capabilities: {
    tools: false,
    streaming: true,
    images: false,
    reasoning: false
  }
};

export const mockProviderModule: ProviderModule<MockProvider> = {
  api: "mock",
  loadProviders: () => []
};
