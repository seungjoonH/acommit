# Changelog

---

## v0.3.2 — 2026-07-21

### Security & Safety

- **Prevent `.env` commits** — stops before reading diff contents when sensitive environment files such as `.env`, `.env.local`, `.env.prod`, `.env.dev`, `.env.development`, or `.env.production` are commit candidates, then asks whether to add protective `.gitignore` rules
- **Allow shareable env templates** — keeps `.env.example`, `.env.sample`, `.env.template`, `.env.production.example`, and similar template files commit-friendly
- **Hard-exclude `node_modules`** — excludes `node_modules` / `.pnpm` paths during diff collection even when `.gitignore` is missing or incomplete

### Result Execution

- **Auto-remove ignored paths** — when result execution sees mixed commands like `git add node_modules src/a.js`, ignored paths are removed and the remaining files are staged
- **Skip ignored-only commits** — if a commit contains only ignored paths such as `node_modules`, the paired `git commit` is skipped instead of failing repeatedly
- **Friendlier Git errors** — `.gitignore`-related `git add` failures are rewritten with a clear explanation and next steps

---

## v0.3.1 — 2026-06-28

### Bug Fixes

- **`acommit rules` / `acommit result` after `npm install`** — settings UI and the result viewer open without `ENOENT` on global and local package installs

### Grouping

- **Removed `grouping.maxGroupSize`** — no separate cap on files per group; token and output limits are the real constraints
- **Better `by-similarity` grouping** — related changes cluster more reliably; locale pairs like `CHANGELOG.en` / `CHANGELOG.ko` are easier to keep in one commit
- **Less truncated output** — long or multi-commit runs are less likely to cut off mid-message (`maxOutputTokens` from `rules.yml` is used fully)
- **Fail fast on bad groups** — if files are missing, duplicated, or otherwise invalid, you get an error instead of nonsense commit messages

### Commit message quality

- **Tag choice** — clearer `refactor` for extract-and-wire changes; `*.md` files lean toward `docs`
- **Strict tag lists** — when only certain tags are allowed, the model is less likely to pick a tag from the path alone (e.g. `feat`/`fix` for `docs/**` when `docs` is not in the list)
- **`lines: multi`** — bullet bodies and `git add` / `git commit` lines are more consistent
- **Korean declarative (`style: declarative`)** — subjects ending in ~함 / ~습니다 follow the configured style more often
- **Message content** — fewer messages guessed from folder names (`k8s`, `migrations`, etc.); more aligned with the actual diff

### CLI

- **`acommit commit` progress** — clearer labels so diff collection is distinct from later steps (`diffs`)
- **Group summary** — prints `N files → M groups` after grouping

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
