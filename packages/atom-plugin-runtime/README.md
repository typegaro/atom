# atom-plugin-runtime

Internal plugin loading and runtime adaptation package.

## Purpose

`atom-plugin-runtime` takes plugin definitions from `@typegaro/atom-plugin` and turns them into runtime objects the app and agent can execute safely.

It contains:

- plugin discovery and loading
- setup-time registration
- capability-gated runtime context wrappers
- plugin manager orchestration

## Main Entrypoints

- `PluginManager`
- `loadPlugins`
- `createPlugin`
