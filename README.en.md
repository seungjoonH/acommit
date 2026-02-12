# acommit — AI Commit Message Automation CLI

A CLI tool that analyzes git diffs and automatically generates **consistent commit messages** based on your team's conventions.

## 1. Installation

### 1) Install

#### via npm

```bash
npm install -g acommit
```

#### from source

```bash
git clone https://github.com/seungjoonH/acommit.git
cd acommit
npm install
npm link
```

### 2) Set Environment Variables

Create a `.env` file in the project root.

#### For Gemini

```
GEMINI_MODEL=your_gemini_model
GEMINI_API_KEY=your_gemini_api_key
```

#### For OpenAI

```
OPENAI_MODEL=your_openai_model
OPENAI_API_KEY=your_openai_api_key
```

> [!WARNING]
> 
> Make sure to add `.env` to `.gitignore` to prevent exposing your API keys!

### 3) Create Rules File

```bash
acommit init          # Create .acommit/rules.yml from template
```

### 4) Run

```bash
acommit commit
```

Results are saved to `.acommit/results/commits/`.


## 2. Available Commands

| Command | Description | Example |
| --- | --- | --- |
| `acommit commit` | Analyze current changes (git diff) and draft commit messages. | `acommit commit` |
| `acommit prompt [--save]` | Add a helper prompt (one-time or persistent). | `acommit prompt -m "Highlight refactoring"` |
| `acommit model` | Select the LLM backend to use. | `acommit model -p gemini` |
| `acommit init` | Create `.acommit/rules.yml` and update `.gitignore`. | `acommit init --lang ko` |
| `acommit --help` | Display CLI help with global options. | `acommit --help` |

### `acommit commit`

```sh
acommit commit
```

Analyzes current changes (`git diff`) and drafts **commit message summaries**.


### `acommit prompt`

```sh
acommit prompt [options]
```

Provides **additional instructions** to the LLM to influence the generated output. Instructions can be used **one-time** or saved **persistently**.

#### Options

| Option | Description | Type |
| :--- | :--- | :--- |
| `-m, --message <msg>` | Provide the prompt inline (skips editor). | optional |
| `--save` | Persist the prompt in `.acommit/rules.yml`. | optional |

#### Flow

1.  By default, `vi` opens for writing instructions.
2.  Without `--save`, the prompt is stored temporarily for the next run only.
3.  With `--save`, the prompt is appended to the config file for repeated use.


### `acommit model`

```sh
acommit model [options]
```

Select the **LLM backend** (`Gemini` or `OpenAI`) for commit message generation.

#### Options

| Option | Description | Type |
| :--- | :--- | :--- |
| `-p, --provider <name>` | Directly set the LLM provider (`gemini` or `openai`). | optional |

#### Flow

1.  Reads the currently configured LLM provider.
2.  Overwrites with the new selection (interactive picker if no option given).
3.  Prints a reminder about required environment variables.


### `acommit init`

```sh
acommit init [options]
```

Creates the `.acommit/rules.yml` config file and updates `.gitignore` to exclude the generated directory.

#### Options

| Option | Description | Type |
| :--- | :--- | :--- |
| `--lang <code>` | Language code for the `.acommit/rules.yml` template. (`en` or `ko`, default `en`) | optional |

#### Flow

1.  If `rules.yml` does not exist, copies the template to create it.
2.  Adds `.acommit/` to `.gitignore` if not already present.


### `acommit --help`

```sh
acommit --help
```

Displays **global options and available commands** for the `acommit` CLI.


## 3. `.acommit/rules.yml` Configuration Guide

The `.acommit/rules.yml` file defines the **behavior** and **commit message style** of the `acommit` CLI. Adjust each setting to match your team's **commit conventions** and **LLM environment**.


### 1. `tags` (Commit Tag Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `enabled` | Whether to use tags (`feat`, `fix`, etc.) | `boolean` | `true` |
| `list` | Allowed tag list (requires team agreement) | `array` | `[feat, fix, docs, ...]` |
| `style` | Tag output format template | `string` | `"{tag}:"` |
| `separator` | Separator between tag and subject | `string` | `" "` |

> **`style` placeholders**:
> * `{tag}`: lowercase (`feat`)
> * `{TAG}`: UPPERCASE (`FEAT`)
> * `{Tag}`: Capitalized (`Feat`)
> * `{scope}`: scope value when `conventional.scope.enabled` is `true`
> * `{sep}`: `separator` value


### 2. `message` (Message Body Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `language` | Language for generated messages | `string` | `"en"` (`ko` \| `en`) |
| `style` | Sentence style | `string` | `"verb"` (`verb` \| `declarative` \| `imperative` \| `past`) |
| `tone` | Message conciseness | `string` | `"concise"` (`concise` \| `detailed`) |
| `lines` | Number of lines | `string` | `"single"` (`single` \| `multi`) |
| `wrap` | Subject line length guideline (no hard wrap) | `integer` | `72` |

#### `message.emoji` (Emoji Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `enabled` | Whether to use per-tag emojis | `boolean` | `false` |
| `map` | Tag-emoji mapping (`feat: "✨"`, `fix: "🐛"`) | `map` | `{ feat: "✨", ... }` |


### 3. `grouping` (Commit Grouping Logic)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `mode` | File grouping mode | `string` | `"by-similarity"` |
| `directoryDepth` | Directory depth for `by-directory` mode | `integer` | `1` |
| `minFilesPerGroup` | Groups below this count fall back to `per-file` | `integer` | `2` |
| `threshold` | Similarity threshold for `by-similarity` (0–1, higher = stricter) | `float` | `0.60` |
| `maxGroupSize` | Maximum files per group | `integer` | `10` |

> **`mode` options**:
> * `per-file`: one commit per file
> * `by-tag`: group by tag (feat/fix/docs/…)
> * `by-directory`: group by directory path
> * `by-similarity`: group by content/path/token similarity
> * `none`: no grouping (messages only)


### 4. `diff` (Diff Processing Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `includeBinary` | Include binary file contents in diff | `boolean` | `false` |
| `untrackedSizeLimit` | Max bytes for new file contents (truncated beyond) | `integer` | `512000` |


### 5. `ignore` (Ignore / Force Tag Assignment)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `files` | Glob patterns to exclude from message generation | `array` | `[package-lock.json, *.lock, ...]` |
| `tagsForPaths` | Force default tags for specific path patterns | `map` | `{ "docs/**": "docs", "scripts/**": "chore" }` |


### 6. `llm` (Large Language Model Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `provider` | LLM service provider | `string` | `"gemini"` (`gemini` \| `openai`) |
| `model` | Model name (falls back to env var if unset) | `string` | `gpt-4o` |
| `maxPromptTokens` | Prompt token upper limit (safety cap) | `integer` | `200000` |
| `maxOutputTokens` | Output token upper limit (safety cap) | `integer` | `4000` |


### 7. `conventional` (Conventional Commits Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `compatible` | Whether to follow Conventional Commits spec | `boolean` | `false` |

#### `conventional.scope` (Scope Settings)

| Key | Description | Type | Default |
| :--- | :--- | :--- | :--- |
| `enabled` | Whether to output scope (`(helper)`, `(api)`) | `boolean` | `false` |
| `inferFromPath` | Auto-infer scope from file path | `boolean` | `true` |

> **Example**: With `compatible: true`, `scope.enabled: true`, `tags.style: "{tag}({scope}):"`,
> the output may look like `"feat(helper): message"`.

> [!TIP]
> Edit the template and commit it so team members inherit the same rules.


## 4. Environment Variables & API Keys

### 1) `.env` Template

See `.env.sample`

```
GEMINI_MODEL=
GEMINI_API_KEY=
OPENAI_MODEL=
OPENAI_API_KEY=
```

### 2) API Keys

  - **Gemini (Google AI Studio)**

    1.  Visit [Google AI Studio](https://makersuite.google.com/).
    2.  Generate an API key and save it as `GEMINI_API_KEY`.
    3.  Set `GEMINI_MODEL` (e.g., `gemini-2.5-flash`).

  - **OpenAI**

    1.  Visit [OpenAI Dashboard](https://platform.openai.com/).
    2.  Save your key as `OPENAI_API_KEY`.
    3.  Choose `OPENAI_MODEL` (e.g., `gpt-4o`, `gpt-4o-mini`).


## 5. License

MIT License © 2025 — SeungjoonH.
Free to use, modify, and distribute as long as attribution is preserved.


## 6. Open Source

This project is open source and welcomes contributions from anyone.  
Bug fixes, feature proposals, documentation improvements, and code refactoring — all forms of **Pull Requests** are welcome.
