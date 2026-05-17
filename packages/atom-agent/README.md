# atom-agent

Internal agent runtime package.

## Purpose

`atom-agent` owns the core agent loop:

- prompt assembly
- message history and session persistence
- tool execution
- plugin hook dispatch
- MCP tool integration

## Main Entrypoints

- `createDefaultAtomAgent`: create a ready-to-run agent using configured providers, plugins, and MCP
- `AtomAgent`: low-level orchestrator around a provider, context, tool runtime, and plugin manager
- `AgentContext`: mutable run/session state

## Notes

This package is intentionally internal. The goal is to keep the public plugin surface in `@typegaro/atom-plugin` and keep the app-facing orchestration in `atom-app`.
