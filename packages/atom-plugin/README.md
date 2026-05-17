# @typegaro/atom-plugin

Public SDK for building Atom plugins.

Use this package when you want to add commands, tools, hooks, panels, UI surfaces, channels, background behavior, or instructions to Atom without importing internal workspace packages.

## Install

```bash
bun add @typegaro/atom-plugin
```

## Minimal plugin

```ts
import { definePlugin } from "@typegaro/atom-plugin";

export default definePlugin({
  id: "my-plugin",
  capabilities: []
});
```

## Create a plugin project

The Atom CLI can scaffold a starter plugin:

```bash
atom init plugin my-plugin
```

Useful options:

```bash
atom init plugin my-plugin --skip-install
atom init plugin my-plugin --name @yourscope/atom-my-plugin --id my-plugin
```

The scaffold creates a publishable package with `package.json`, `index.ts`, `build.mjs`, `README.md`, and `.gitignore`.

## Package shape

A plugin package should expose compiled JavaScript and point Atom at the plugin entrypoint with `atom.plugins` in `package.json`:

```json
{
  "name": "@yourscope/atom-my-plugin",
  "type": "module",
  "atom": {
    "plugins": ["./dist/index.js"]
  },
  "files": ["dist"]
}
```

Prefer publishing compiled `dist/` artifacts instead of raw `src/` files.

## Common exports

| Export | Purpose |
| --- | --- |
| `definePlugin` | Declare a plugin with a typed definition. |
| `AgentHookName` | Register lifecycle hooks around runs, model calls, and tool calls. |
| `PluginEventName` | Subscribe to core runtime events. |
| `RuntimeEventType` | Shared runtime event contract. |
| `SessionEventType` | Shared session event contract. |

Some shared contracts, such as `getConfigPaths`, are available from [`@typegaro/atom-types`](../atom-types/README.md).

## Capability model

Plugins explicitly declare the capabilities they need. Examples include:

- `hooks`
- `runs`
- `models`
- `sessions`
- `config`
- `panels`

Runtime helpers expose only the capabilities declared by the plugin. This keeps the public API small and makes missing permissions easier to diagnose.

## Install and load a plugin

Install a published plugin globally:

```bash
atom plugin install @scope/atom-plugin-name
```

Install a plugin only for the current project:

```bash
atom plugin install --local @scope/atom-plugin-name
```

Add it to a bundle:

```bash
atom bundle create my-bundle <plugin-name>
```

Run Atom with that bundle:

```bash
atom --bundle my-bundle --provider <provider-name> --model <model-id> chat "Say hello"
```

Use `atom plugin list` to find the exact discovered plugin name.

## Related packages

- [`@typegaro/atom`](../atom-cli/README.md): CLI users install and run as `atom`.
- [`@typegaro/atom-types`](../atom-types/README.md): shared public event, message, tool, and config path contracts.
