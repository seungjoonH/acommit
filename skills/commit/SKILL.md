---
name: commit
description: Generate validated AI commit messages for staged or unstaged changes in a repository configured with `.acommit/rules.yml`, and optionally execute isolated commits and pushes. Use when the user asks to analyze changes, group files, create commit messages, commit changes, or push commits with acommit.
---

# acommit commit

Read local settings with `settings-get`. `.acommit/rules.yml` is the commit-policy source of truth and `.acommit/settings.local.yml` is the personal execution source of truth.

## Resolve the bridge

Use `CLAUDE_PLUGIN_ROOT` when available. Otherwise locate the installed acommit plugin directory containing a plugin manifest and `src/skill/bridge.mjs`. Run every command with `--cwd "<target-repo>"`.

## Configure first-run behavior

Run `settings-get`. Ask only for execution values returned as `null`, then persist each answer with `settings-set`:

```bash
node <bridge> settings-get --cwd "<target-repo>"
node <bridge> settings-set --cwd "<target-repo>" --key autoExecuteGit --value false
```

Ask about `autoExecuteGit`, `autoPush`, `envGuardMode`, and `confirmPlanBeforeGenerate`. Never infer permission to commit or push.

If `commit.backend` is `api`, run `acommit commit --headless --json`. If API setup is incomplete, read `references/api-backend-setup.md` from the plugin root and follow it exactly. Never fall back automatically. On API failure offer only retry, use Agent once, reconfigure API, or cancel; a one-time Agent choice must not change the saved backend. If the API command succeeds, use its saved session and continue with execution only when allowed.

If `commit.backend` is `agent`, use the bridge workflow below. If backend is unanswered, ask once for Agent or API and persist it.

## Collect and protect changes

Run `node <bridge> collect --cwd "<target-repo>"`. Stop on `no-changes` or `ok: false`. Obey the stored environment guard mode and re-run collection after editing `.gitignore`.

## Finalize grouping

Use deterministic plans unchanged. For `needs-grouping`, follow both returned grouping prompts and validate the requested JSON:

```bash
node <bridge> finalize-plan --cwd "<target-repo>" --agent-text '<grouping JSON>'
```

When confirmation is enabled, show files, tag, and rationale for every group and wait for approval.

## Generate and validate messages

Follow each generate plan's `system` and `user` prompts exactly, then validate the response:

```bash
node <bridge> format-commit --cwd "<target-repo>" --text '<raw response>' --files '["file1"]'
```

Revise once using any reported validation issue. Stop without committing after a second failure.

## Execute or present commands

Present returned shell commands when automatic execution is disabled. Otherwise execute each group in plan order:

```bash
node <bridge> execute --cwd "<target-repo>" --files '["file1"]' --message '<commitMessage>'
```

Add `--push true` only when automatic push is enabled. Report the message, files, and actual execution result for each group.

After generation or execution, call `save-agent-session` with the final plan, formatted commits, execution fields, and current host identity. This keeps `acommit result` identical for Agent and API backends.
