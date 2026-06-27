// Escape shell glob metacharacters in a file path so `git add` is safe.
function escapePath(p) {
  return p.replace(/[\[\]()]/g, '\\$&');
}

/**
 * Parse a single-group LLM response into structured commit data.
 * LLM output format (from build.js system prompt):
 *   <subject>
 *   - optional body line
 *
 *   git add file1 file2
 *   git commit -m "<subject>"
 */
export function parseCommitText(raw, groupFiles = [], cfg = {}) {
  const lines = raw
    .replace(/^```[^\n]*\n?/m, '')  // strip opening fence
    .replace(/\n?```\s*$/m, '')      // strip closing fence
    .split('\n');

  // Find start of shell block (first git add/commit line)
  const gitStart = lines.findIndex(l => /^git (add|commit)\b/.test(l.trim()));

  const msgLines = (gitStart >= 0 ? lines.slice(0, gitStart) : lines)
    .map(l => l.trim())
    .filter(Boolean);

  const shellLines = (gitStart >= 0 ? lines.slice(gitStart) : [])
    .map(l => l.trim())
    .filter(l => /^git (add|commit)\b/.test(l))
    .map(l => {
      if (/^git add\b/.test(l)) {
        const paths = l.slice('git add'.length).trim().split(/\s+/);
        return 'git add ' + paths.map(escapePath).join(' ');
      }
      return l;
    });

  const commitLine = shellLines.find((l) => /^git commit\b/.test(l))
    ?? (subject ? `git commit -m "${subject.replace(/"/g, '\\"')}"` : null);

  const shell = groupFiles.length && commitLine
    ? [`git add ${groupFiles.map(escapePath).join(' ')}`, commitLine]
    : shellLines;

  const subject = msgLines[0] ?? '';
  const body = msgLines.slice(1)
    .filter(l => /^[-*]\s/.test(l))
    .map(l => l.replace(/^[-*]\s+/, ''));

  // Extract tag from subject using known tag list
  let tag = null;
  let message = subject;
  const knownTags = cfg?.tags?.list ?? [];

  for (const t of knownTags) {
    // Match: tag: msg / tag(scope): msg / [tag]: msg / (tag): msg / [TAG]: msg
    const re = new RegExp(
      `^(?:\\[?${t}\\]?|\\(${t}\\))(?:\\([^)]*\\))?\\s*[:\\s]\\s*(.+)`,
      'i'
    );
    const m = subject.match(re);
    if (m) {
      tag = t;
      message = m[1].trim();
      break;
    }
  }

  // Fallback: anything before first ": "
  if (!tag) {
    const colonMatch = subject.match(/^(\w+)(?:\([^)]*\))?\s*:\s*(.+)/);
    if (colonMatch) {
      tag = colonMatch[1].toLowerCase();
      message = colonMatch[2].trim();
    }
  }

  return {
    files: groupFiles,
    tag,
    message,
    subject,
    body,
    shell,
  };
}
