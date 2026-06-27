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
