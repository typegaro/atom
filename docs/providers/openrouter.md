# OpenRouter

Use this provider when you want Atom to talk to OpenRouter through the official OpenRouter SDK.

## Configure auth

The preferred way to add OpenRouter auth is:

```bash
atom login openrouter
```

This prompts for your API key and stores it in `~/.atom/auth.json` under the `openrouter` auth name.

## Configure models

Then add an `openrouter` provider to `~/.atom/models.json`:

```json
{
  "providers": {
    "openrouter": {
      "api": "openrouter",
      "authName": "openrouter",
      "models": [
        {
          "id": "<openrouter-model-id>"
        },
        {
          "id": "<another-openrouter-model-id>"
        }
      ]
    }
  }
}
```

## Manual auth

You can also add the matching API key entry to `~/.atom/auth.json` manually:

```json
{
  "providers": {
    "openrouter": {
      "type": "api-key",
      "apiKey": "<openrouter-api-key>"
    }
  }
}
```

## Required fields

| Field | Description |
| --- | --- |
| `api` | Must be `openrouter`. |
| `authName` | Auth entry name in `~/.atom/auth.json`. Defaults to `openrouter`. |
| `models` | One or more model entries with an `id`. |

## Run a prompt

```bash
atom --provider openrouter --model <openrouter-model-id> chat "Say hello"
```

## Verify the setup

```bash
atom models
atom --provider openrouter --model <openrouter-model-id> doctor
```

## Notes

- Model capability depends on the upstream OpenRouter route.
- If an image request fails with a capability error, the selected route likely does not support image input.
- For generic OpenAI-compatible access to OpenRouter, use the [OpenAI-compatible provider](openai-compatible.md) instead.
