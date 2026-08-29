---
name: infer-rules
description: Analyze a repository's Git commit history and changed-file patterns to infer an evidence-backed `.acommit/rules.yml`. Use when onboarding acommit, reconstructing an existing team's commit convention, reviewing rule drift, or asking to generate or update acommit rules from historical commits.
---

# acommit infer rules

Infer only conventions supported by historical evidence. Never infer credentials, providers, automatic commit permission, or automatic push permission.

## Resolve and analyze

Resolve the installed plugin's `src/skill/bridge.mjs` using `CLAUDE_PLUGIN_ROOT` when available or the plugin manifest otherwise. Analyze up to 200 recent commits by default:

```bash
node <bridge> analyze-history --cwd "<target-repo>" --max-count 200
node <bridge> analyze-history --cwd "<target-repo>" --max-count 200 --since "12 months ago"
```

The bridge excludes merge, revert, and bot commits and returns deterministic suggestions plus evidence.

## Review evidence

Recommend the default template instead of applying inferred rules when `sufficientSample` is false. Otherwise show analyzed and excluded counts, every proposed rule, confidence and support, existing-rule differences, and non-inferable fields.

Treat grouping and path tags as recommendations. Do not invent `llm`, `skill`, credentials, diff exclusions, or execution settings.

## Confirm and apply

Present complete proposed YAML and obtain explicit approval before writing. Apply only the reviewed object:

```bash
node <bridge> apply-inferred-rules --cwd "<target-repo>" --rules '<suggestedRules JSON>'
```

The command merges inferred sections and backs up an existing file as `.acommit/rules.yml.bak`. Report written and backup paths, sample size, and settings that still require manual choice.
