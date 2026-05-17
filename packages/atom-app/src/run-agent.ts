import type { AtomAgent } from "atom-agent";
import type { AgentRunEvent } from "atom-ai";
import { StreamEventType } from "atom-ai";
import type { RuntimeEvent } from "@typegaro/atom-types";
import { RuntimeEventType } from "@typegaro/atom-types";
import type { UserMessagePart } from "atom-ai";
import { formatToolCall } from "./format-tool-call";

// The app layer uses a narrower runtime event schema than the provider and
// agent internals. This adapter translates streamed agent events into the UI
// contract and interleaves plugin runtime events at the point they become
// relevant, usually right after a tool finishes.

function createToolRunEndEvents(event: Extract<AgentRunEvent, { type: StreamEventType.ToolRunEnd }>): RuntimeEvent[] {
  return [{
    id: event.toolCall.id,
    type: RuntimeEventType.ToolRunEnd,
    name: event.toolCall.name,
    text: event.result.content.map((part: { text: string }) => part.text).join("\n"),
    isError: event.result.isError
  }];
}

function toAppEvents(event: AgentRunEvent): RuntimeEvent[] {
  if (event.type === StreamEventType.Interrupted) {
    return [{ type: RuntimeEventType.Interrupted }];
  }

  if (event.type === StreamEventType.MessageStart) {
    return [{ type: RuntimeEventType.MessageStart }];
  }

  if (event.type === StreamEventType.TextDelta) {
    return [{ type: RuntimeEventType.TextDelta, delta: event.delta }];
  }

  if (event.type === StreamEventType.ThinkingDelta) {
    return [{ type: RuntimeEventType.ThinkingDelta, delta: event.delta }];
  }

  if (event.type === StreamEventType.ToolRunStart) {
    return [{ type: RuntimeEventType.ToolRunStart, id: event.toolCall.id, name: event.toolCall.name, label: formatToolCall(event.toolCall), arguments: event.toolCall.arguments }];
  }

  if (event.type === StreamEventType.ToolRunEnd) {
    return createToolRunEndEvents(event);
  }

  if (event.type === StreamEventType.Error) {
    return [{ type: RuntimeEventType.Error, error: event.error }];
  }

  if (event.type === StreamEventType.RunEnd) {
    return [{ type: RuntimeEventType.Done }];
  }

  return [];
}

// Runs the agent and yields app-level runtime events in the order the UI
// expects, including plugin-emitted runtime events that piggyback on tool runs.
export async function* runAgent(agent: AtomAgent, input: UserMessagePart[]): AsyncGenerator<RuntimeEvent> {
  const run = agent.run(input);
  let sawError = false;
  let sawInterrupt = false;

  try {
    for await (const event of run) {
      for (const appEvent of toAppEvents(event)) {
        if (appEvent.type === RuntimeEventType.Error) {
          sawError = true;
        }

        if (appEvent.type === RuntimeEventType.Interrupted) {
          sawInterrupt = true;
        }

        yield appEvent;
      }

      // Yield plugin runtime events (e.g. file-edit) right after the tool
      // that produced them, instead of draining everything at the end.
      if (event.type === StreamEventType.ToolRunEnd) {
        for (const pluginEvent of agent.drainRuntimeEvents()) {
          yield pluginEvent;
        }
      }
    }

    await run.result();

    // Drain any remaining plugin runtime events
    for (const pluginEvent of agent.drainRuntimeEvents()) {
      yield pluginEvent;
    }
  } catch (error) {
    if (!sawError && !sawInterrupt) {
      yield {
        type: RuntimeEventType.Error,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
