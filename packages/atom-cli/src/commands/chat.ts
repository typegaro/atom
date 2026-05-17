import type { Command } from "commander";
import { AgentBundleManager } from "atom-bundle";
import { ContentPartType, StreamEventType, type AgentRunEvent } from "atom-ai";
import type { AtomCliContext } from "../context";

// Registers the simplest end-to-end smoke path for the runtime: create an
// agent, stream events to the terminal, and surface tool activity on stderr so
// assistant text remains readable on stdout.
export function registerChatCommand(program: Command, context: AtomCliContext): void {
  program
    .command("chat")
    .description("Send a prompt to Atom")
    .argument("[prompt...]", "Prompt text")
    .action(async (promptParts: string[]) => {
      const prompt = promptParts.join(" ").trim() || "Say hello from Atom.";
      const agent = await buildAgent(context);
      const run = agent.run([{ type: ContentPartType.Text, text: prompt }]);

      for await (const event of run) {
        renderEvent(event);
      }

      process.stdout.write("\n");
    });
}

async function buildAgent(context: AtomCliContext) {
  if (!context.cliProviderName || !context.cliModelId) {
    throw new Error("Provider and model are required. Use --provider <name> --model <id>.");
  }

  const bundleManager = new AgentBundleManager({
    pluginAllowList: context.cliPluginAllowList,
    includeMcp: true
  });
  await bundleManager.loadIfNeeded();

  const runtime = await bundleManager.createAgentRuntime({
    provider: context.cliProviderName,
    model: context.cliModelId
  });
  const bundle = await bundleManager.getBundle();

  const { AtomAgent } = await import("atom-agent");
  return new AtomAgent({ runtime, bundle });
}

function renderEvent(event: AgentRunEvent): void {
  switch (event.type) {
    case StreamEventType.TextDelta:
      process.stdout.write(event.delta);
      break;
    case StreamEventType.ToolRunStart:
      process.stderr.write(`\n[tool:start] ${event.toolCall.name}\n`);
      break;
    case StreamEventType.ToolRunEnd:
      process.stderr.write(`[tool:end] ${event.toolCall.name}\n`);
      break;
    case StreamEventType.Error:
      process.stderr.write(`\n[error] ${event.error}\n`);
      break;
    default:
      break;
  }
}
