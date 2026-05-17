import type { ChatMessages, ChatFunctionTool } from "@openrouter/sdk/models";
import { ContentPartType } from "../../types/content-part";
import type { Context } from "../../types/context";
import type { Message } from "../../types/message";
import { MessageRole } from "../../types/message-role";
import type { ToolDefinition } from "../../types/tool";

export function convertOpenRouterTools(tools?: ToolDefinition[]): ChatFunctionTool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>
    }
  }));
}

function flattenTextContent(content: Extract<Message, { role: MessageRole.Assistant | MessageRole.Tool | MessageRole.User }>["content"]): string {
  return content
    .filter((part): part is { type: ContentPartType.Text; text: string } => part.type === ContentPartType.Text)
    .map((part) => part.text)
    .join("\n");
}

export function buildOpenRouterMessages(context: Context): ChatMessages[] {
  const messages: ChatMessages[] = [];

  if (context.system) {
    messages.push({ role: "system", content: context.system });
  }

  for (const message of context.messages) {
    if (message.role === MessageRole.User) {
      const content = message.content.map((part) => {
        if (part.type === ContentPartType.Text) {
          return { type: ContentPartType.Text, text: part.text } as const;
        }
        return {
          type: "image_url" as const,
          imageUrl: { url: `data:${part.mimeType};base64,${part.data}` }
        };
      });

      messages.push({
        role: MessageRole.User,
        content: content.length === 1 && content[0].type === ContentPartType.Text
          ? content[0].text
          : (content as never)
      });
      continue;
    }

    if (message.role === MessageRole.Tool) {
      messages.push({
        role: MessageRole.Tool,
        toolCallId: message.toolCallId,
        content: flattenTextContent(message.content)
      });
      continue;
    }

    const toolCalls = message.content
      .filter((part): part is Extract<typeof part, { type: ContentPartType.ToolCall }> => part.type === ContentPartType.ToolCall)
      .map((part) => ({
        id: part.id,
        type: "function" as const,
        function: {
          name: part.name,
          arguments: JSON.stringify(part.arguments)
        }
      }));

    const textContent = message.content
      .filter((part): part is { type: ContentPartType.Text; text: string } => part.type === ContentPartType.Text)
      .map((p) => p.text)
      .join("\n");

    messages.push({
      role: MessageRole.Assistant,
      content: textContent || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    } as never);
  }

  return messages;
}
