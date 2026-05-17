# @typegaro/atom

Bun-first command line interface for Atom.

This is the user-facing package published as `@typegaro/atom`. Installing it provides the `atom` command.

## Install

```bash
bun add -g @typegaro/atom
```

Verify the install:

```bash
atom --help
```

## Quick start

```bash
atom login deepseek
atom models
atom doctor
atom --provider deepseek --model deepseek-v4-flash chat "Say hello"
```

## Common commands

| Command | Purpose |
| --- | --- |
| `atom login <provider>` | Add provider auth or setup. Supports `deepseek`, `codex`, `openrouter`, and `openai-compatible`. |
| `atom models` | List configured providers and models. |
| `atom doctor` | Check configuration and runtime setup. |
| `atom chat "..."` | Run a prompt through the selected provider and model. |
| `atom plugin list` | List discovered plugins. |
| `atom plugin install <package-spec>` | Install a global plugin package. |
| `atom plugin install --local <package-spec>` | Install a project-local plugin package. |
| `atom bundle list` | List plugin bundles. |
| `atom bundle create <bundle-name> <plugin-name>...` | Create or replace a bundle. |
| `atom bundle delete <bundle-name>` | Delete a bundle. |
| `atom bundle tag <bundle-name> <tag>` | Add a tag to a bundle. |
| `atom bundle untag <bundle-name> <tag>` | Remove a tag from a bundle. |
| `atom init plugin <name>` | Scaffold a plugin project. |

## Provider setup

The first way to add providers is the login command:

```bash
atom login deepseek
atom login codex
atom login openrouter
atom login openai-compatible
```

`deepseek` and `openrouter` prompt for API keys, `codex` starts the OAuth flow, and `openai-compatible` prints custom provider setup instructions.

## Provider selection

Most agent commands accept `--provider` and `--model`:

```bash
atom --provider <provider-name> --model <model-id> chat "Your prompt"
```

Example:

```bash
atom --provider deepseek --model deepseek-v4-flash chat "Say hello"
```

## Plugins and bundles

Install a plugin:

```bash
atom plugin install <package-spec>
```

Create a bundle:

```bash
atom bundle create my-bundle <plugin-name>
```

Run with that bundle:

```bash
atom --bundle my-bundle --provider <provider-name> --model <model-id> chat "Your prompt"
```

Use `atom plugin list` to find the exact plugin names Atom discovers.

## Documentation

- [Repository README](../../README.md)
- [Getting started](../../docs/getting-started.md)
- [Provider guides](../../docs/providers)
- [`@typegaro/atom-plugin`](../atom-plugin/README.md)
- [`@typegaro/atom-types`](../atom-types/README.md)

## Development notes

This package contains:

- built-in CLI commands such as `login`, `chat`, `doctor`, `plugin`, `bundle`, and `init plugin`;
- plugin-provided CLI command registration;
- plugin installation and scaffold helpers.

Source layout:

| Path | Purpose |
| --- | --- |
| `src/index.ts` | CLI composition root. |
| `src/commands/` | Built-in command modules. |
| `src/plugin-package-manager.ts` | npm-based plugin install/remove helpers. |
| `src/plugin-scaffold.ts` | Plugin template generation. |
