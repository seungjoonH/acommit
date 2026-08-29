---
name: init
description: Initialize acommit in a repository, preserve or infer existing commit rules, choose the Agent or API commit backend, and configure safe personal execution settings. Use when the user asks to create, initialize, onboard, or set up acommit.
---

# acommit init

Resolve the plugin root and target repository. Run `acommit init` for workspace creation. When rules already exist, ask exactly: keep them, supplement from Git history, regenerate defaults, or cancel. Never overwrite automatically; use the infer-rules Skill for the history option and require approval before applying it.

Run the bridge `settings-get`. Offer Agent or API as the persistent plugin commit backend. For API, read the plugin-root `references/api-backend-setup.md` and follow it exactly. For Agent, save `backend=agent`, then collect unanswered execution settings. Never infer commit or push permission.

Confirm that `.acommit/settings.local.yml` and `.acommit/results/` are ignored while `.acommit/rules.yml` remains shareable. Report every created, retained, migrated, or ignored file.
