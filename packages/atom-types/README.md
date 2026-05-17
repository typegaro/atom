# @typegaro/atom-types

Shared public Atom contracts.

This package is the canonical source of public types shared by the Atom runtime and the plugin SDK. Use it when you need event, session, message, tool, provider, or config path contracts without depending on Atom internals.

## Install

```bash
bun add @typegaro/atom-types
```

Most plugin authors should install [`@typegaro/atom-plugin`](../atom-plugin/README.md) first. Use this package directly when you only need shared type contracts.

## Main exports

| Export | Purpose |
| --- | --- |
| `RuntimeEventType` | Runtime-level event names and contracts. |
| `SessionEventType` | Session-level event names and contracts. |
| `ContentPartType` | Message content part identifiers. |
| `MessageRole` | Shared message role identifiers. |
| `ApiId` | Public provider API identifiers. |
| `getConfigPaths` | Standard Atom configuration path helper. |

## Configuration paths

Atom uses the following standard locations:

| Scope | Path | Purpose |
| --- | --- | --- |
| Global | `~/.atom/models.json` | Provider and model settings. |
| Global | `~/.atom/auth.json` | API keys and OAuth credentials. |
| Global | `~/.atom/mcp.json` | Global MCP servers. |
| Global | `~/.atom/plugins/` | Global loose plugin files or folders. |
| Global | `~/.atom/npm/` | Globally installed npm or Git plugins. |
| Global | `~/.atom/bundles.json` | Global plugin bundles. |
| Global | `~/.atom/skills/` | Global skills. |
| Local | `./.atom/mcp.json` | Project MCP servers. |
| Local | `./.atom/plugins/` | Project loose plugin files or folders. |
| Local | `./.atom/npm/` | Project-local npm or Git plugins. |
| Local | `./.atom/bundles.json` | Project plugin bundles. |
| Local | `./.atom/skills/` | Project skills. |

## Related packages

- [`@typegaro/atom`](../atom-cli/README.md): Bun-first CLI users install and run as `atom`.
- [`@typegaro/atom-plugin`](../atom-plugin/README.md): public SDK for building Atom plugins.
