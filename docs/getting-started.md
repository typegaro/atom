# Getting started

This guide walks through installing Atom, configuring a model, running your first prompt, and extending Atom with plugins, bundles, MCP servers, and skills.

## Requirements

- [Bun](https://bun.sh/) installed and available on your `PATH`
- A model provider, such as ChatGPT Pro / Max, OpenRouter, or an OpenAI-compatible endpoint

## Install Atom

Atom is published as `@typegaro/atom` and is intended to run with Bun:

```bash
bun add -g @typegaro/atom
```

Check that the CLI is available:

```bash
atom --help
```

## Configure a model

Atom needs a provider and a model before it can run an agent. The preferred path is to use `atom login <provider>` when the provider supports it.

For example, add DeepSeek with an API key:

```bash
atom login deepseek
```

Or sign in to the Codex / ChatGPT-backed provider:

```bash
atom login codex
```

You can also use:

```bash
atom login openrouter
atom login openai-compatible
```

`deepseek` and `openrouter` prompt for an API key and store it in `~/.atom/auth.json`. `codex` stores OAuth credentials and exposes the `codex` provider. `openai-compatible` prints the `models.json` shape for custom endpoints.

List available models:

```bash
atom models
```

Run a simple prompt:

```bash
atom --provider deepseek --model deepseek-v4-flash chat "Say hello"
```

Or with Codex:

```bash
atom --provider codex --model gpt-5.5 chat "Say hello"
```

Provider guides:

- [ChatGPT Pro / Max](providers/chatgpt-pro-max.md)
- [OpenRouter](providers/openrouter.md)
- [OpenAI-compatible providers](providers/openai-compatible.md)

If a provider is not covered by `atom login`, add provider settings to `~/.atom/models.json` and matching API keys to `~/.atom/auth.json` manually.

## Configuration scopes

Atom reads global configuration and project-local configuration.

### Global configuration

Global config applies everywhere:

| Path | Purpose |
| --- | --- |
| `~/.atom/models.json` | Provider and model settings. |
| `~/.atom/auth.json` | API keys and OAuth credentials. |
| `~/.atom/mcp.json` | Global MCP servers. |
| `~/.atom/npm/` | Globally installed npm or Git plugins. |
| `~/.atom/plugins/` | Globally available loose plugin files or folders. |
| `~/.atom/bundles.json` | Global plugin bundles. |
| `~/.atom/skills/` | Global skills. |

### Project-local configuration

Local config applies only when you run Atom from that project directory:

| Path | Purpose |
| --- | --- |
| `./.atom/mcp.json` | Project MCP servers. |
| `./.atom/npm/` | Project-local npm or Git plugins. |
| `./.atom/plugins/` | Project-local loose plugin files or folders. |
| `./.atom/bundles.json` | Project plugin bundles. |
| `./.atom/skills/` | Project skills. |

Local entries override global entries with the same name. Use local config for project-specific behavior and global config for your default setup.

## Install plugins

Atom plugins can add commands, tools, instructions, hooks, panels, UI surfaces, channels, and background behavior.

Install a plugin globally:

```bash
atom plugin install <package-spec>
```

Install a plugin only for the current project:

```bash
atom plugin install --local <package-spec>
```

`<package-spec>` is passed to `npm install`, so it can be an npm package, GitHub shorthand, or Git URL:

```bash
atom plugin install @scope/atom-plugin-name
atom plugin install github:user/repo
atom plugin install git+https://github.com/user/repo.git
```

List discovered plugins:

```bash
atom plugin list
```

Uninstall a package-based plugin:

```bash
atom plugin uninstall <package-name>
atom plugin uninstall --local <package-name>
```

## Use local plugin files

You can also place plugin files directly in Atom plugin directories.

Global loose plugins go in:

```text
~/.atom/plugins/
```

Project-local loose plugins go in:

```text
./.atom/plugins/
```

Supported shapes:

```text
./.atom/plugins/my-plugin.ts
./.atom/plugins/my-plugin/index.ts
./.atom/plugins/my-plugin/index.js
./.atom/plugins/my-plugin/package.json
```

If a plugin folder has a `package.json`, Atom reads `atom.plugins` from it:

```json
{
  "atom": {
    "plugins": ["./dist/index.js"]
  }
}
```

## Use bundles

A bundle is a named list of plugins. Installing a plugin makes it available; adding the discovered plugin name to a bundle decides when it is loaded.

Use `atom plugin list` to find the exact plugin name to put in a bundle.

Create a global bundle:

```bash
atom bundle create my-bundle <plugin-name>
```

Create a project-local bundle:

```bash
atom bundle create --local my-bundle <plugin-name>
```

Add, remove, tag, or delete bundles:

```bash
atom bundle add my-bundle <plugin-name>
atom bundle remove my-bundle <plugin-name>
atom bundle tag my-bundle <tag>
atom bundle untag my-bundle <tag>
atom bundle delete my-bundle

atom bundle add --local my-bundle <plugin-name>
atom bundle remove --local my-bundle <plugin-name>
```

List bundles:

```bash
atom bundle list
atom bundle list --global
atom bundle list --local
```

Run Atom with only the plugins from a bundle:

```bash
atom --bundle my-bundle --provider <provider-name> --model <model-id> chat "Your prompt"
```

Plugin-provided commands are registered after the bundle is selected. For example, if a bundle contains a UI plugin that adds an `opentui` command, launch it through the bundle:

```bash
atom --bundle my-bundle --provider <provider-name> --model <model-id> opentui
```

## Add MCP servers

MCP servers add external tools to the agent.

Global MCP config lives at `~/.atom/mcp.json`. Project-local MCP config lives at `./.atom/mcp.json`.

Example remote server:

```json
{
  "my-server": {
    "type": "remote",
    "url": "https://example.com/mcp",
    "enabled": true
  }
}
```

Use local MCP config when the server belongs to one project. Use global MCP config when you want the server available everywhere.

## Add skills

Skills are plain instruction folders. Each skill must contain a `SKILL.md` file.

Global skill:

```text
~/.atom/skills/my-skill/SKILL.md
```

Project-local skill:

```text
./.atom/skills/my-skill/SKILL.md
```

Use local skills for project-specific workflows and global skills for personal defaults.

## Create a custom plugin

Generate a starter plugin project:

```bash
atom init plugin my-plugin
```

Useful options:

```bash
atom init plugin my-plugin --skip-install
atom init plugin my-plugin --name @yourscope/atom-my-plugin --id my-plugin
```

The scaffold creates a publishable package with `package.json`, `index.ts`, `build.mjs`, `README.md`, and `.gitignore`.

Install the plugin SDK in custom plugin projects when needed:

```bash
bun add @typegaro/atom-plugin
```

See [`@typegaro/atom-plugin`](../packages/atom-plugin/README.md) for the public plugin authoring surface.

## Check the setup

Use `doctor` when something does not load as expected:

```bash
atom doctor
atom --provider <provider-name> --model <model-id> doctor
```

Common checks:

- Run Atom from the project root if you expect `./.atom/*` config to load.
- Use `atom plugin list` to confirm Atom can discover a plugin.
- Use `atom bundle list --local` or `atom bundle list --global` to confirm the plugin is in the bundle.
- Use `atom models` to confirm the provider and model are available.

## Next steps

- Configure a provider: [ChatGPT Pro / Max](providers/chatgpt-pro-max.md), [OpenRouter](providers/openrouter.md), or [OpenAI-compatible providers](providers/openai-compatible.md).
- Install plugins and group them into bundles.
- Add project-local MCP servers and skills for repository-specific workflows.
- Build a plugin with [`@typegaro/atom-plugin`](../packages/atom-plugin/README.md).
