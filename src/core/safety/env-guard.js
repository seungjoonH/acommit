import fs from 'node:fs/promises';
import path from 'node:path';
import { matchesGlob } from '../ignore/match.js';
import { selectOption, createTuiSession, pc } from '../../ui/tui.js';
import logger from '../../utils/logger.js';

export const ENV_GITIGNORE_PATTERNS = [
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.sample',
  '!.env.template',
  '!.env.default',
  '!.env.defaults',
  '!.env.dist',
  '!.env*.example',
  '!.env*.sample',
  '!.env*.template',
  '!.env*.default',
  '!.env*.defaults',
  '!.env*.dist',
];

const SAFE_ENV_TOKENS = new Set([
  'example',
  'sample',
  'template',
  'default',
  'defaults',
  'dist',
]);

function basename(filePath) {
  return String(filePath || '').split('/').pop() ?? '';
}

export function isSensitiveEnvPath(filePath) {
  const name = basename(filePath);
  if (name !== '.env' && !name.startsWith('.env.')) return false;

  const lower = name.toLowerCase();
  const tokens = lower.split(/[._-]+/).filter(Boolean);
  return !tokens.some((token) => SAFE_ENV_TOKENS.has(token));
}

function parseGitignore(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function stripNegation(pattern) {
  return pattern.startsWith('!') ? pattern.slice(1) : pattern;
}

function stripRoot(pattern) {
  return pattern.startsWith('/') ? pattern.slice(1) : pattern;
}

function stripDirectoryOnly(pattern) {
  return pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
}

function normalizePattern(pattern) {
  return stripDirectoryOnly(stripRoot(stripNegation(pattern)));
}

function matchesGitignorePattern(pattern, filePath) {
  const normalized = normalizePattern(pattern);
  return matchesGlob(normalized, filePath);
}

export function isIgnoredByGitignore(filePath, content) {
  let ignored = false;
  for (const pattern of parseGitignore(content)) {
    if (!matchesGitignorePattern(pattern, filePath)) continue;
    ignored = !pattern.startsWith('!');
  }
  return ignored;
}

export function missingEnvGitignorePatterns(content) {
  const lines = new Set(parseGitignore(content));
  return ENV_GITIGNORE_PATTERNS.filter((pattern) => !lines.has(pattern));
}

async function readGitignore(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  try {
    return { path: gitignorePath, content: await fs.readFile(gitignorePath, 'utf8') };
  } catch {
    return { path: gitignorePath, content: '' };
  }
}

async function appendEnvGitignorePatterns(gitignorePath, content, patterns) {
  if (!patterns.length) return false;
  const block = [
    '# Local environment files',
    ...patterns,
  ].join('\n');
  const updated = content.trimEnd() + (content.length ? '\n\n' : '') + `${block}\n`;
  await fs.writeFile(gitignorePath, updated, 'utf8');
  return true;
}

function formatFileList(files) {
  return files.map((file) => `  - ${file}`).join('\n');
}

function messages(locale) {
  const ko = locale !== 'en';
  return {
    title: ko ? 'acommit 보안 경고' : 'acommit security warning',
    prompt: ko
      ? '민감한 .env 파일이 커밋 후보에 있습니다. .gitignore 보호 규칙을 추가할까요?'
      : 'Sensitive .env files are commit candidates. Add .gitignore protection rules?',
    add: ko ? '추가하고 중단' : 'Add and stop',
    addHint: ko ? '.gitignore에 .env 패턴 추가 후 다시 확인' : 'append .env patterns to .gitignore',
    stop: ko ? '중단' : 'Stop',
    stopHint: ko ? '파일을 직접 정리' : 'clean up files manually',
    added: ko
      ? '[acommit] .gitignore에 .env 보호 규칙을 추가했습니다. 민감 파일이 빠졌는지 확인한 뒤 다시 실행하세요.'
      : '[acommit] Added .env protection rules to .gitignore. Review the remaining files, then run again.',
    nonInteractive: ko
      ? '[acommit] 보안 중단: 민감한 .env 파일이 커밋 후보에 있지만 .gitignore 보호 규칙이 없습니다.'
      : '[acommit] Security stop: sensitive .env files are commit candidates and .gitignore is not protected.',
    stillPresent: ko
      ? '[acommit] 보안 중단: 민감한 .env 파일이 커밋 후보에 남아 있습니다.'
      : '[acommit] Security stop: sensitive .env files are still commit candidates.',
    candidates: ko ? '커밋 후보:' : 'Commit candidates:',
    missing: ko ? '.gitignore에 추가할 패턴:' : 'Patterns to add to .gitignore:',
    trackedHint: ko
      ? '이미 tracked/staged 된 파일은 .gitignore만으로 빠지지 않습니다. git rm --cached 또는 git restore --staged로 먼저 제외하세요.'
      : 'Already tracked/staged files are not removed by .gitignore. Remove them with git rm --cached or git restore --staged first.',
  };
}

export async function guardSensitiveEnvFiles({
  cwd,
  files,
  locale = 'ko',
} = {}) {
  const sensitiveFiles = [...new Set((files || []).filter(isSensitiveEnvPath))].sort();
  if (!sensitiveFiles.length) return { ok: true, added: false };

  const { path: gitignorePath, content } = await readGitignore(cwd);
  const unignored = sensitiveFiles.filter((file) => !isIgnoredByGitignore(file, content));
  const m = messages(locale);

  if (!unignored.length) {
    logger.error(
      `${m.stillPresent}\n${m.candidates}\n${formatFileList(sensitiveFiles)}\n${m.trackedHint}`,
      { exit: false },
    );
    return { ok: false, added: false };
  }

  const missing = missingEnvGitignorePatterns(content);
  if (!process.stdin.isTTY) {
    logger.error(
      `${m.nonInteractive}\n${m.candidates}\n${formatFileList(unignored)}\n${m.missing}\n${formatFileList(missing)}`,
      { exit: false },
    );
    return { ok: false, added: false };
  }

  const tui = createTuiSession(m.title);
  const choice = await selectOption({
    session: tui,
    step: m.prompt,
    subtitle: '.gitignore',
    options: [
      { value: 'add', label: m.add, hint: m.addHint },
      { value: 'stop', label: m.stop, hint: m.stopHint },
    ],
    initialValue: 'add',
  });

  if (choice === 'add') {
    await appendEnvGitignorePatterns(gitignorePath, content, missing);
    tui.finish(pc.green(m.added));
    return { ok: false, added: true };
  }

  tui.cancel(m.trackedHint);
  return { ok: false, added: false };
}
