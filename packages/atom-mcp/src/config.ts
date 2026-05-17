import { existsSync } from "node:fs";
import { getConfigPaths } from "@typegaro/atom-types";
import { readJsonFile, listScopedPaths } from "./config-utils";

export interface RemoteMcpServerSettings {
  type: "remote";
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
}

export interface McpSettings {
  servers: Record<string, RemoteMcpServerSettings>;
}

export interface RemoteMcpServerSource extends RemoteMcpServerSettings {
  name: string;
  scope: "global" | "local";
  sourcePath: string;
}

export function listRemoteMcpServers(cwd = process.cwd()): RemoteMcpServerSource[] {
  const servers = new Map<string, RemoteMcpServerSource>();
  const paths = getConfigPaths(cwd);

  for (const [path, scope] of listScopedPaths(paths.mcp, paths.localMcp, cwd)) {
    if (!existsSync(path)) {
      continue;
    }

    const parsed = readJsonFile<Record<string, unknown>>(path);

    for (const [name, value] of Object.entries(parsed)) {
      const server = parseRemoteMcpServer(name, value);
      if (!server) {
        continue;
      }

      servers.delete(name);
      servers.set(name, { name, scope, sourcePath: path, ...server });
    }
  }

  return Array.from(servers.values());
}

export function loadMcpSettings(cwd = process.cwd()): McpSettings {
  const servers = Object.fromEntries(
    listRemoteMcpServers(cwd).map(({ name, scope: _scope, sourcePath: _sourcePath, ...server }) => [name, server])
  );

  return { servers };
}

export function listEnabledRemoteMcpServers(
  settings = loadMcpSettings(),
  cwd = process.cwd()
): Array<RemoteMcpServerSettings & { name: string }> {
  const source = settings === undefined ? loadMcpSettings(cwd) : settings;
  return Object.entries(source.servers)
    .filter(([, server]) => server.enabled)
    .map(([name, server]) => ({ name, ...server }));
}

function parseRemoteMcpServer(name: string, value: unknown): RemoteMcpServerSettings | undefined {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid MCP server config for ${name}`);
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.type !== "remote") {
    return undefined;
  }

  if (typeof candidate.url !== "string" || candidate.url.trim().length === 0) {
    throw new Error(`MCP server ${name} must include a non-empty url`);
  }

  if (typeof candidate.enabled !== "boolean") {
    throw new Error(`MCP server ${name} must include enabled: true/false`);
  }

  return {
    type: "remote",
    url: candidate.url,
    enabled: candidate.enabled,
    headers: parseStringRecord(candidate.headers, `servers.${name}.headers`)
  };
}

function parseStringRecord(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be an object of strings`);
  }

  const entries = Object.entries(value);

  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== "string") {
      throw new Error(`${label}.${key} must be a string`);
    }
  }

  return Object.fromEntries(entries) as Record<string, string>;
}
