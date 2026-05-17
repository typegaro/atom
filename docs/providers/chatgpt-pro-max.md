# ChatGPT Pro / Max

Use this provider when you want Atom to use the OpenAI Responses client backed by your ChatGPT OAuth session.

Atom exposes this provider as `codex`.

## When to use it

Use this path when:

- you want the built-in OpenAI Responses adapter;
- you have ChatGPT OAuth access through `atom login codex`;
- you want Atom to configure supported Responses models automatically;
- you need image input with a model that supports it.

## Sign in

Run:

```bash
atom login codex
```

Atom writes OAuth credentials to:

```text
~/.atom/auth.json
```

## Available models

After login, Atom automatically exposes the `codex` provider. You do not need to add these models manually to `~/.atom/models.json`.

Current built-in model IDs:

- `gpt-5.4`
- `gpt-5.5`

## Run a prompt

```bash
atom --provider codex --model gpt-5.5 chat "Say hello"
```

## Verify the setup

```bash
atom doctor
atom models
```

If login succeeded, `gpt-5.4` and `gpt-5.5` should appear under the `codex` provider even if they are not in `models.json`.

## Troubleshooting

- If the provider is missing, run `atom login codex` again and then `atom models`.
- If an image request fails, confirm the selected model supports image input.
- If credentials look stale, inspect or refresh `~/.atom/auth.json` with `atom login codex`.
