import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { listRemoteMcpServers, type RemoteMcpServerSettings } from "./config";
import type { ToolDefinition } from "atom-ai";

type RemoteServerConfig = RemoteMcpServerSettings & { name: string };

type McpToolContent = {
  type?: string;
  text?: string;
};

type McpToolResult = {
  content?: McpToolContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

type ManagedClient = {
  client: Client;
  transport: StreamableHTTPClientTransport;
};

export interface McpManager {
  isLoaded(): boolean;
  loadIfNeeded(): Promise<void>;
  getToolDefinitions(): ToolDefinition[];
  getConnectedServerCount(): number;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  reload(allowList?: Set<string>): Promise<void>;
  close(): Promise<void>;
}

// RemoteMcpManager treats each remote MCP server as a source of additional tool
// definitions. Connection failures are soft by design: one bad server should not
// prevent the rest of the runtime from booting or expose half-loaded tool state.
export class RemoteMcpManager implements McpManager {
  private loaded = false;
  private readonly serverTools = new Map<string, { tool: ToolDefinition; serverName: string; toolName: string }>();
  private readonly clients = new Map<string, ManagedClient>();

  constructor(
    private readonly cwd = process.cwd(),
    private serverAllowList?: Set<string>
  ) {}

  isLoaded(): boolean {
    return this.loaded;
  }

  async loadIfNeeded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    const allServers = listRemoteMcpServers(this.cwd).filter((server) => server.enabled);
    const servers = this.serverAllowList
      ? allServers.filter((s) => this.serverAllowList!.has(s.name))
      : allServers;
    await Promise.all(servers.map((server) => this.loadServer(server)));
    this.loaded = true;
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.serverTools.values()).map((entry) => entry.tool);
  }

  getConnectedServerCount(): number {
    return this.clients.size;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const entry = this.serverTools.get(name);

    if (!entry) {
      throw new Error(`Unknown MCP tool: ${name}`);
    }

    const managedClient = this.clients.get(entry.serverName);

    if (!managedClient) {
      throw new Error(`MCP server ${entry.serverName} is not connected`);
    }

    const result = await managedClient.client.callTool({
      name: entry.toolName,
      arguments: args
    }) as McpToolResult;

    if (result.isError) {
      throw new Error(flattenToolResult(result));
    }

    return flattenToolResult(result);
  }

  /** Reload MCP connections: close all, then reconnect with an optional new allow-list. */
  async reload(allowList?: Set<string>): Promise<void> {
    if (allowList) this.serverAllowList = allowList;
    await this.close();
    this.serverTools.clear();
    this.loaded = false;
    await this.loadIfNeeded();
  }

  async close(): Promise<void> {
    for (const { client, transport } of this.clients.values()) {
      try {
        await transport.terminateSession();
      } catch {
        // ignore transport shutdown errors
      }

      await client.close();
    }

    this.clients.clear();
  }

  // Tool names are namespaced locally because multiple servers can export the
  // same upstream tool name and the agent needs a single flat tool namespace.
  private async loadServer(server: RemoteServerConfig): Promise<void> {
    try {
      const transport = new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: {
          headers: new Headers(resolveHeaders(server))
        }
      });
      const client = new Client({ name: `atom-mcp-${server.name}`, version: "0.0.1" });

      await client.connect(transport);

      this.clients.set(server.name, { client, transport });

      const response = await client.listTools();

      for (const tool of response.tools ?? []) {
        const localName = normalizeToolName(server.name, tool.name);
        this.serverTools.set(localName, {
          tool: { name: localName, description: tool.description, inputSchema: tool.inputSchema ?? { type: "object", properties: {} } },
          serverName: server.name,
          toolName: tool.name
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping MCP server ${server.name}: ${message}`);
    }
  }
}

function normalizeToolName(serverName: string, toolName: string): string {
  const normalizedServer = normalizeToolSegment(serverName);
  const normalizedTool = normalizeToolSegment(toolName);
  return `mcp_${normalizedServer}_${normalizedTool}`;
}

function normalizeToolSegment(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "tool";
}

function resolveHeaders(server: RemoteServerConfig): Record<string, string> | undefined {
  if (!server.headers || Object.keys(server.headers).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(server.headers).map(([key, value]) => [key, expandEnv(value)])
  );
}

function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_match, name: string) => process.env[name] ?? "");
}

function flattenToolResult(result: McpToolResult): string {
  const text = (result.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n");

  if (text) {
    return text;
  }

  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent, null, 2);
  }

  return "MCP tool completed with no text output.";
}
