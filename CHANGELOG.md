# Changelog

All notable changes to this project will be documented in this file.

---

## [v0.2.0](https://github.com/seungjoonH/acommit/releases/tag/v0.2.0) — 2026-02-13

Stable release expanding the commit automation pipeline with multi-provider LLM support, prompt management, and improved developer experience.

### Added

- **Multi-provider LLM support** — Gemini and OpenAI, switchable via `acommit model`
- **Prompt system** — one-time (`acommit prompt`) and persistent (`acommit prompt --save`) helper prompts
- **Prompt logging** — every LLM request is recorded under `.acommit/results/prompts/`
- **Config schema normalization** — partial `rules.yml` is auto-merged with defaults; invalid values are corrected
- **Logger with secret masking** — long strings without whitespace (likely API keys) are automatically masked in verbose output
- **i18n documentation** — `README.md` (overview) + `README.en.md` (English) + `README.ko.md` (Korean)
- **English as default template language** — `acommit init` now generates `commit.en.yml` by default

### Changed

- **`acommit run` → `acommit commit`** — clearer command name, single responsibility
- **Prompt builder streamlined** — commit-only system/user prompt with cleaner structure
- **Result storage** — `appendResult` writes to `results/commits/` with metadata headers
- **Config templates moved** — `samples/config/commit.{en,ko}.yml`
- **LLM client factory** — `createLLMClient(provider)` with `{ gen }` contract, validated by contract tests

---

## [v0.1.0](https://github.com/seungjoonH/acommit/releases/tag/v0.1.0) — 2025-11-08

Initial release. Foundation of the CLI and core commit generation pipeline.

### Added

- **CLI entry point** — `bin/acommit.js` with Commander-based routing
- **`acommit commit`** — analyze `git diff` and generate commit messages using Gemini
- **`acommit init`** — create `.acommit/rules.yml` from template and update `.gitignore`
- **Git adapter** (`src/adapters/git.js`) — `execFile`-based wrapper for `git status`, `diff`, `ls-files`
- **DiffCollector** — collects staged, unstaged, and untracked file diffs; handles binary files and size-limited truncation
- **Prompt builder** — dynamically constructs system/user prompts from config (tags, message style, grouping policy, conventional commits)
- **Gemini LLM integration** — `@google/generative-ai` SDK with multi-shape fallback for resilience across SDK versions
- **Config system** — `.acommit/rules.yml` with YAML parsing, schema defaults, and normalization
  - `tags`: tag list, style template (`{tag}`, `{TAG}`, `{Tag}`), separator, case, bracket
  - `message`: language, style (verb/declarative/imperative/past), tone, lines, wrap, emoji mapping
  - `grouping`: per-file, by-tag, by-directory, by-similarity, none
  - `diff`: binary inclusion, untracked size limit
  - `ignore`: file glob patterns, path-to-tag forced mappings
  - `conventional`: Conventional Commits compatibility, scope inference
  - `llm`: provider, model, token limits
- **Config templates** — `commit.ko.yml`, `commit.en.yml` with inline comments
- **Progress UI** — file processing progress bar (`cli-progress`) and LLM request spinner
- **Result persistence** — generated messages saved to `.acommit/results/` with timestamps
- **Token budget management** — estimates tokens by `chars / 3.6`, truncates diff at safe anchors (`[FILENAME]`, `----`)
