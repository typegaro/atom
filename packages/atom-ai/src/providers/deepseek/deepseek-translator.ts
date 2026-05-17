import type { Context } from "../../types/context";
import type { ThinkingPart } from "../../types/message";
import { MessageRole } from "../../types/message-role";
import type { ModelDefinition } from "../../types/model";
import type { ProviderOptions } from "../base/provider";
import {
  OpenAICompatibleTranslator,
  type OpenAICompatibleMessage,
  type OpenAICompatibleRequest
} from "../openai-compatible/openai-compatible-translator";

// DeepSeekTranslator extends the shared OpenAI-compatible mapping with the few
// reasoning fields DeepSeek expects in both transcript replay and live requests.
export class DeepSeekTranslator extends OpenAICompatibleTranslator {
  protected override toMessages(context: Context): OpenAICompatibleMessage[] {
    const messages = super.toMessages(context);

    const assistantSources = context.messages.filter((m) => m.role === MessageRole.Assistant);
    let assistantIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "assistant") continue;

      const source = assistantSources[assistantIndex++];
      if (!source) continue;

      const thinking = source.content
        .filter((p): p is ThinkingPart => p.type === "thinking")
        .map((p) => p.text)
        .join("\n");

      if (thinking) {
        messages[i] = { ...messages[i], reasoning_content: thinking };
      }
    }

    return messages;
  }

  override toStreamingRequest(model: ModelDefinition, context: Context, options?: ProviderOptions): OpenAICompatibleRequest {
    const base = super.toStreamingRequest(model, context, options);

    if (!model.capabilities.reasoning) {
      return base;
    }

    return {
      ...base,
      thinking: { type: "enabled" },
      reasoning_effort: "medium"
    } as OpenAICompatibleRequest;
  }
}
