# acommit

**AI-powered commit message automation CLI**

Analyzes git diffs and generates consistent commit messages based on your team's conventions defined in a shared YAML config file.

## Quick Start

### via npm

```bash
npm install -g acommit
acommit init
acommit commit
```

### from source

```bash
git clone https://github.com/seungjoonH/acommit.git
cd acommit
npm install
npm link
acommit init
acommit commit
```

## Documentation

| Language | npm | GitHub |
| --- | --- | --- |
| English | [README.en.md](https://www.npmjs.com/package/acommit/file/README.en.md) | [README.en.md](https://github.com/seungjoonH/acommit/blob/main/README.en.md) |
| 한국어 | [README.ko.md](https://www.npmjs.com/package/acommit/file/README.ko.md) | [README.ko.md](https://github.com/seungjoonH/acommit/blob/main/README.ko.md) |

## Agent Plugin

The same plugin bundle supports Claude Code, Codex, and Cursor:

| Workflow | Claude Code | Codex | Cursor |
| --- | --- | --- | --- |
| Initialize | `/acommit:init` | `$init` | `/init` |
| Create commits | `/acommit:commit` | `$commit` | `/commit` |
| Configure | `/acommit:config` | `$config` | `/config` |
| Infer rules from Git history | `/acommit:infer-rules` | `$infer-rules` | `/infer-rules` |
| View results | `/acommit:result` | `$result` | `/result` |

The plugin asks once whether commits should use the current Agent or an acommit API provider. Personal choices are stored in the gitignored `.acommit/settings.local.yml`; shared commit conventions remain in `.acommit/rules.yml`. Direct `acommit commit` runs the configured API for that invocation without changing the plugin backend. Plugin API runs use `acommit commit --headless --json`.

For local Claude Code development, run `claude --plugin-dir /path/to/acommit`. Cursor can load the repository as a local plugin with `cursor agent --plugin-dir /path/to/acommit`. Codex uses the bundled `.codex-plugin/plugin.json` manifest.

## Safety

`acommit commit` stops before reading sensitive `.env` files, keeps env templates such as `.env.example` commit-friendly, and hard-excludes `node_modules` / `.pnpm` paths from diff collection.

## License

MIT © 2025 SeungjoonH
