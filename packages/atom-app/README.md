# atom-app

Internal application orchestration package.

## Purpose

`atom-app` adapts `atom-agent` into app-facing controllers and runtimes.

It owns:

- model/session controllers
- runtime event translation for app consumers
- session loading helpers
- runtime host support used by plugins and channels

## Main Entrypoints

- `AtomAppController`
- `AtomRuntimeHost`
- `runAgent`

## When To Change This Package

Use `atom-app` when the change is about how external callers drive the agent, switch models, subscribe to runtime events, or open plugin-managed sessions.
