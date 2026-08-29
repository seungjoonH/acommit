/** Unstage everything before selective `git add` in result viewer / batch commits. */
export const GIT_UNSTAGE_ALL = 'git restore --staged .';

export function escapePath(p) {
  return p.replace(/[\[\]()]/g, '\\$&');
}

export function isAllowedExecuteCommand(cmd) {
  const t = String(cmd ?? '').trim();
  if (t === GIT_UNSTAGE_ALL) return true;
  if (/^git add\b/.test(t)) return true;
  if (/^git commit\b/.test(t)) return true;
  if (/^git status\b/.test(t)) return true;
  return false;
}

export function parseGitAddCommand(cmd) {
  const t = String(cmd ?? '').trim();
  if (!/^git add\b/.test(t)) return null;

  const parts = t.slice('git add'.length).trim().split(/\s+/).filter(Boolean);
  const paths = [];
  let force = false;

  for (const part of parts) {
    if (part === '--') continue;
    if (part === '-f' || part === '--force' || part === '--no-ignore-removal') {
      force = true;
      continue;
    }
    if (part.startsWith('-')) continue;
    paths.push(part.replace(/\\([\[\]()])/g, '$1'));
  }

  return { force, paths };
}

export function formatIgnoredGitAddError(paths = []) {
  const list = [...new Set(paths.filter(Boolean))];
  const rendered = list.length ? list.join(', ') : '(unknown)';
  return [
    `커밋할 수 없는 경로가 포함되어 있습니다: ${rendered}`,
    '이 경로는 .gitignore 규칙으로 무시되고 있어 Git이 add를 거부했습니다.',
    '보통 node_modules, dist, .env 같은 파일/디렉터리는 커밋하지 않습니다.',
    '커밋 결과에서 해당 경로를 제외한 뒤 다시 실행하세요.',
    '정말 저장소에 포함해야 하는 파일이라면 터미널에서 직접 git add -f <path>를 실행하세요.',
  ].join('\n');
}

export function formatIgnoredGitAddSkip(paths = []) {
  const list = [...new Set(paths.filter(Boolean))];
  const rendered = list.length ? list.join(', ') : '(unknown)';
  return [
    `자동 제외: .gitignore로 무시된 경로를 커밋에서 뺐습니다: ${rendered}`,
    '보통 node_modules, dist, .env 같은 파일/디렉터리는 커밋하지 않습니다.',
  ].join('\n');
}

export function formatSkippedCommitAfterIgnoredAdd(paths = []) {
  const list = [...new Set(paths.filter(Boolean))];
  const rendered = list.length ? list.join(', ') : '(unknown)';
  return `건너뜀: 커밋 대상이 ignored 경로뿐이라 git commit을 실행하지 않았습니다: ${rendered}`;
}

export function extractIgnoredPathsFromGitAddError(stderr) {
  const text = String(stderr ?? '');
  if (!/ignored by one of your \.gitignore files/i.test(text)) return [];

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const paths = [];
  let collecting = false;

  for (const line of lines) {
    if (/^hint:/i.test(line)) break;
    if (/ignored by one of your \.gitignore files:/i.test(line)) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon) paths.push(afterColon);
      collecting = true;
      continue;
    }
    if (collecting) paths.push(line);
  }

  return paths
    .flatMap((line) => line.split(/\s+/))
    .map((path) => path.replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** git restore --staged . → git add … → git commit … */
export function buildCommitShellLines(files, commitLine) {
  const lines = [];
  const paths = Array.isArray(files) ? files : [];
  if (paths.length) {
    lines.push(GIT_UNSTAGE_ALL);
    lines.push(`git add ${paths.map(escapePath).join(' ')}`);
  }
  if (commitLine) lines.push(commitLine);
  return lines;
}
