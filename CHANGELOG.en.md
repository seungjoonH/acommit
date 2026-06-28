# Changelog

---

## v0.3.1 — 2026-06-28

### Bug Fixes

- **`acommit rules` / `acommit result` (npm install)** — use the prebuilt `dist/web` bundle when `web/src` is not shipped; fixes `ENOENT` failures on global/npm installs

### Grouping

- **Removed `grouping.maxGroupSize`** — no artificial cap on files per commit group; token/output budgets remain the real limits
- **Plan auto-repair** — LLM plan gaps (missing/duplicate/unknown paths) are fixed from the heuristic draft before validation; no re-request
- **Output token cap** — per-group generate uses full `llm.maxOutputTokens` (removed hidden 800-token ceiling)
- **Plan → Generate pipeline** — `by-similarity` runs one LLM **plan** request (intent grouping JSON), then one **generate** request per group; structural modes (`per-file`, `by-directory`, `by-tag`) use rules-only plans with no extra LLM call
- **Plan validation** — every file exactly once, path tag conflicts, and optional `expectedGroups` oracle (eval) fail before any commit message is generated
- **Heuristic draft** — path-similarity clustering is sent to the LLM planner as a hint only in `by-similarity` mode, not as the final partition

### Prompt Quality

- **Tag heuristics** — stronger `refactor` guidance for extract-and-wire scenarios; hints filtered to allowed tags only
- **`*.md`** — default `tagsForPaths` maps all markdown to `docs`; per-group `REQUIRED TAG` hint
- **Grouping instructions** — clearer do/don't rules for `by-directory`, `by-similarity`, and `per-file` modes
- **`lines=multi`** — per-group prompt includes multiline `git commit -m` example

### CLI UX

- **`acommit commit`** — clarify that the progress bar is diff collection; print `N files → M groups` after grouping
- **Progress bar** — label renamed `progress` → `diffs` to distinguish from LLM/commit steps

---

## v0.3.0 — 2026-06-27

### Result Viewer

Review and run generated commits directly from your browser.

- `acommit result` — open the result viewer in your browser
- After `acommit commit` finishes, the viewer opens automatically (`Ctrl+C` to stop)
- Browse changed files per commit in a collapsible file tree
- Edit commit subjects inline, copy shell commands, or run `git commit` with one click
- Batch tag-style editor for reformatting all commits at once

### Localization

Unify the CLI output and viewer UI in your preferred language.

- `acommit locale ko` / `acommit locale en` — set the language
- Run without an argument to use the interactive picker
- Setting is saved in `.acommit/locale`

### OpenRouter Support

Access hundreds of models with a single API key via OpenRouter.

- Select with `acommit model -p openrouter`
- Or set `llm.provider: openrouter` in `rules.yml`
- Requires `OPENROUTER_API_KEY` environment variable

### Other Improvements

- **Tag defaults changed** — `tags.style` now defaults to `"{tag}"`, `tags.separator` to `": "` (e.g. `feat: message`)
- **Spinner stability** — fixed spinner printing on new lines in non-standard terminals (Cursor, etc.)
- **Model info display** — model name is now shown once at start instead of repeating in every spinner
- **`git add` path escaping** — paths containing `[`, `]`, `(`, `)` are now automatically escaped

---

## v0.2.0 — 2026-02-13

### Multi-Provider LLM

- Choose between Gemini and OpenAI — switch anytime with `acommit model`
- Pin your preferred provider and model in `rules.yml` via `llm.provider` / `llm.model`

### Prompt System

- `acommit prompt` — add a one-time instruction for the next run only
- `acommit prompt --save` — persist the instruction in `.acommit/rules.yml`

### Stability & DX

- Partial `rules.yml` files are auto-merged with defaults — no need to fill every field
- API keys and secrets are automatically masked in verbose log output
- Every LLM request is logged to `.acommit/results/prompts/`

### Breaking

- Command renamed: `acommit run` → `acommit commit`

---

## v0.1.0 — 2025-11-08

Initial release.

- `acommit commit` — analyze `git diff` and generate commit messages with Gemini
- `acommit init` — create `.acommit/rules.yml` and update `.gitignore`
- `rules.yml` config: tags, message style, grouping, diff handling, ignore patterns, conventional commits
- Handles staged, unstaged, and untracked files
- Four grouping strategies: per-file, by-tag, by-directory, by-similarity
- Token budget management with automatic diff truncation
