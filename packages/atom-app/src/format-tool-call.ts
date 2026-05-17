import type { ToolCall } from "atom-ai";

type ToolFormatter = (args: Record<string, unknown>) => string;

const FORMATTERS: Record<string, ToolFormatter> = {
  read(args) {
    const path = typeof args.filePath === "string" ? args.filePath : "<path>";
    const extras = [
      typeof args.offset === "number" ? `offset=${args.offset}` : undefined,
      typeof args.limit === "number" ? `limit=${args.limit}` : undefined
    ].filter((v): v is string => Boolean(v));
    return extras.length > 0 ? `Read ${path} [${extras.join(", ")}]` : `Read ${path}`;
  },
  write(args) {
    const path = typeof args.path === "string" ? args.path : "<path>";
    const content = typeof args.content === "string" ? args.content : "";
    return `Write ${path} [${content.length} chars]`;
  },
  edit(args) {
    const path = typeof args.path === "string" ? args.path : "<path>";
    const oldText = typeof args.oldText === "string" ? args.oldText : "";
    const newText = typeof args.newText === "string" ? args.newText : "";
    return `Edit ${path} [${oldText.length} -> ${newText.length} chars]`;
  },
  bash(args) {
    const command = typeof args.command === "string" ? args.command : "<command>";
    return `Bash ${command}`;
  },
  load_skill(args) {
    const name = typeof args.name === "string" ? args.name : "<skill>";
    return `LoadSkill ${name}`;
  }
};

export function formatToolCall(toolCall: ToolCall): string {
  const formatter = FORMATTERS[toolCall.name];
  if (formatter) return formatter(toolCall.arguments);

  const details = Object.entries(toolCall.arguments)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");

  const name = toolCall.name ? `${toolCall.name[0].toUpperCase()}${toolCall.name.slice(1)}` : "";
  return details ? `${name} [${details}]` : name;
}
