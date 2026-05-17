# OpenAI-compatible providers

Use this provider when you want Atom to talk to a backend that exposes an OpenAI-compatible chat completions API.

Examples include:

- LM Studio;
- local gateways that mimic the OpenAI API;
- hosted services with OpenAI-compatible chat completions endpoints.

For OpenRouter, prefer the dedicated [OpenRouter provider](openrouter.md) unless you specifically need the generic OpenAI-compatible path.

## Configure models

Add a provider to `~/.atom/models.json`:

```json
{
  "providers": {
    "my-provider": {
      "api": "openai-completions",
      "baseUrl": "https://example.com/v1",
      "authName": "my-provider",
      "models": [
        {
          "id": "my-model-id",
          "name": "My Model"
        }
      ]
    }
  }
}
```

## Configure auth

If `authName` is set, add a matching API key entry to `~/.atom/auth.json`:

```json
{
  "providers": {
    "my-provider": {
      "type": "api-key",
      "apiKey": "<api-key>"
    }
  }
}
```

If the backend does not require an API key, omit `authName` from `~/.atom/models.json`.

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `api` | Yes | Must be `openai-completions`. |
| `baseUrl` | Yes | Base URL for the compatible API, usually ending in `/v1`. |
| `authName` | No | Auth entry name in `~/.atom/auth.json`. Omit only when the backend does not require an API key. |
| `models` | Yes | Array of model definitions. |

Optional model fields:

| Field | Description |
| --- | --- |
| `name` | Human-readable display name. |
| `contextWindow` | Context window size, if known. |
| `maxOutputTokens` | Maximum output token count, if known. |

## Example: local LM Studio endpoint

```json
{
  "providers": {
    "local": {
      "api": "openai-completions",
      "baseUrl": "http://127.0.0.1:1234/v1",
      "models": [
        {
          "id": "local-model"
        }
      ]
    }
  }
}
```

Run with the local model:

```bash
atom --provider local --model local-model chat "Say hello"
```

## Verify the setup

```bash
atom models
atom --provider my-provider --model my-model-id doctor
```

## Troubleshooting

- Confirm `baseUrl` points to the API root expected by your backend.
- Confirm `authName` in `models.json` matches the key in `auth.json`.
- Confirm the model ID matches the backend's model identifier exactly.
