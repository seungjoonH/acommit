#!/usr/bin/env node
/**
 * Recreates examples/screenshot-demo/ — a tiny git repo with staged-like
 * working-tree changes for README result-viewer screenshots.
 *
 * Usage (from repo root):
 *   node examples/setup-screenshot-demo.mjs
 *   cd examples/screenshot-demo && acommit commit
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(__dirname, 'screenshot-demo');
const RULES_KO = path.join(ROOT, 'samples/config/commit.ko.yml');
const RULES_EN = path.join(ROOT, 'samples/config/commit.en.yml');

const BASE = {
  'package.json': JSON.stringify({
    name: 'screenshot-demo',
    private: true,
    version: '0.1.0',
    type: 'module',
    description: 'Minimal sample repo for acommit README screenshots',
  }, null, 2) + '\n',

  'README.md': `# screenshot-demo

Local-only sample project for **acommit result viewer** screenshots.

\`\`\`bash
# from acommit repo root (after setup)
cd examples/screenshot-demo
acommit commit    # opens result GUI — take screenshots
acommit result    # reopen last session
\`\`\`

Reset changes: \`node ../../examples/setup-screenshot-demo.mjs\`
`,

  'src/auth/login.js': `export function validateLogin(email, password) {
  if (!email || !password) return false;
  return email.includes('@');
}
`,

  'src/auth/logout.js': `export function clearSession(session) {
  if (!session) return;
  session.userId = null;
}
`,

  'src/auth/middleware.js': `export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
`,

  'src/utils/format.js': `export function formatLabel(value) {
  return String(value ?? '').trim();
}
`,

  'src/utils/counter.js': `export function createCounter(initial = 0) {
  let n = initial;
  return {
    inc: () => ++n,
    value: () => n,
  };
}
`,

  'docs/api.md': `# API

## Auth

- POST /login
- POST /logout
`,
};

const CHANGED = {
  'src/auth/login.js': `export function validateLogin(email, password) {
  if (!email?.trim() || !password?.trim()) return false;
  if (!email.includes('@')) return false;
  if (password.length < 8) return false;
  return true;
}
`,

  'src/auth/logout.js': `export function clearSession(session) {
  if (!session) return;
  session.userId = null;
  session.token = null;
  session.expiresAt = null;
}
`,

  'src/auth/middleware.js': `export function requireAuth(req, res, next) {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
`,

  'src/utils/format.js': `export function formatLabel(value) {
  const s = String(value ?? '').trim();
  return s.length ? s : '—';
}

export function slugify(value) {
  return formatLabel(value).toLowerCase().replace(/\\s+/g, '-');
}
`,

  'src/utils/counter.js': `export function createCounter(initial = 0) {
  let n = Number(initial) || 0;
  return {
    inc: (step = 1) => { n += step; return n; },
    dec: (step = 1) => { n -= step; return n; },
    value: () => n,
    reset: () => { n = 0; },
  };
}
`,

  'docs/api.md': `# API

## Auth

- POST /login — email + password
- POST /logout — clears session cookie

## Utils

- Shared formatting helpers in \`src/utils/\`
`,
};

async function writeTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function main() {
  await fs.rm(DEMO, { recursive: true, force: true });
  await fs.mkdir(DEMO, { recursive: true });

  await writeTree(DEMO, BASE);

  run('git init -b main', DEMO);
  run('git config user.email "demo@acommit.local"', DEMO);
  run('git config user.name "acommit demo"', DEMO);
  run('git add -A', DEMO);
  run('git commit -m "chore: initial screenshot demo baseline"', DEMO);

  await writeTree(DEMO, CHANGED);

  const acomDir = path.join(DEMO, '.acommit');
  await fs.mkdir(path.join(acomDir, 'results/commits'), { recursive: true });
  await fs.copyFile(RULES_KO, path.join(acomDir, 'rules.yml'));
  await fs.writeFile(path.join(acomDir, 'locale'), 'ko\n', 'utf8');
  await fs.copyFile(RULES_EN, path.join(acomDir, 'rules.en.yml'));
  await fs.writeFile(
    path.join(acomDir, 'README.txt'),
    'rules.yml — active config (ko, by-similarity)\nrules.en.yml — swap for English message.lang screenshots\n',
    'utf8',
  );

  console.log('\n✓ screenshot-demo ready at examples/screenshot-demo/');
  console.log('  cd examples/screenshot-demo && acommit commit');
  console.log('  English UI: acommit locale en  |  English messages: edit message.lang in rules.yml');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
