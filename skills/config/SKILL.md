---
name: config
description: Inspect or change acommit rules, prompts, API provider and model, UI locale, commit-message language, backend, and personal execution settings. Use when the user asks to configure, change, explain, or troubleshoot any acommit setting.
---

# acommit config

Route the user's intent to existing CLI commands: rules → `acommit rules`, prompt → `acommit prompt`, model/API → the bridge setup flow, and UI language → `acommit locale`. Commit-message language belongs to `rules.yml` and is distinct from UI locale.

Use `settings-get` and `settings-set` for backend and execution settings. When switching to API, always read the plugin-root `references/api-backend-setup.md` and follow it exactly. When legacy settings are reported, ask before running `settings-migrate`. Do not display secrets or update `backend: api` before validation and final confirmation.
