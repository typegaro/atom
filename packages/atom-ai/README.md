# atom-ai

Internal provider and streaming package.

## Purpose

`atom-ai` wraps model providers behind a shared interface and stream model.

It contains:

- provider registration and construction
- provider adapters for OpenAI-compatible APIs, OpenRouter, DeepSeek, and OpenAI Responses
- stream event contracts used by the agent runtime
- model/provider context types

## Main Entrypoints

- `createProvider`
- `registerProvider`
- provider classes such as `OpenAICompatibleProvider`
- `EventStream`

## Boundaries

Shared public message and tool contracts live in `@typegaro/atom-types`. `atom-ai` builds provider-specific behavior on top of those contracts.
