# atom-mcp

Internal remote MCP integration package.

## Purpose

`atom-mcp` connects to configured remote MCP servers, exposes their tools to the agent runtime, and handles MCP tool execution.

## Main Entrypoints

- `RemoteMcpManager`
- `McpManager`

## Notes

Tool names are normalized into the local `mcp_<server>_<tool>` shape before they are exposed to the agent.
