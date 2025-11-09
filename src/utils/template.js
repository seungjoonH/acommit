import fs from 'node:fs/promises';
import path from 'node:path';

// Template discovery utility
// Priority:
// 1) .github directory templates
// 2) templates/.acommit.issue.md or templates/.acommit.pr.md (auto-generated when missing)

function sanitizeTemplate(content = "") {
  const stripped = content
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('>')) return false;
      if (trimmed.includes('#123')) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripped;
}

async function readFirstMdInDir(dir) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && f.name.toLowerCase().endsWith('.md')) {
        const raw = await fs.readFile(path.join(dir, f.name), 'utf8');
        return sanitizeTemplate(raw);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function readFileIfExists(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return sanitizeTemplate(raw);
  } catch {
    return null;
  }
}

export async function getTemplate(cwd, type) {
  const gh = path.join(cwd, '.github');
  // Issue template lookup
  if (type === 'issue') {
    // .github/ISSUE_TEMPLATE/*.md
    const dir1 = path.join(gh, 'ISSUE_TEMPLATE');
    const t1 = await readFirstMdInDir(dir1);
    if (t1) return t1;

    // .github/issue_template.md
    const p2 = path.join(gh, 'issue_template.md');
    const t2 = await readFileIfExists(p2);
    if (t2) return t2;
  }

  // PR template lookup
  if (type === 'pr') {
    const p1 = path.join(gh, 'PULL_REQUEST_TEMPLATE.md');
    const t1 = await readFileIfExists(p1);
    if (t1) return t1;

    // .github/PULL_REQUEST_TEMPLATE/*.md
    const dir2 = path.join(gh, 'PULL_REQUEST_TEMPLATE');
    const t2 = await readFirstMdInDir(dir2);
    if (t2) return t2;
  }

  // fallback: templates/.acommit.issue.md or templates/.acommit.pr.md
  const templatesDir = path.join(cwd, 'samples', 'templates');
  const fallbackName = type === 'issue' ? 'issue.md' : 'pr.md';
  const fallbackPath = path.join(templatesDir, fallbackName);
  const fallback = await readFileIfExists(fallbackPath);
  if (fallback) return fallback;

  // Default content creation
  const defaultContent = type === 'issue'
    ? `# Issue Draft\n\n## Summary\n\n## Context\n\n## Tasks\n\n## Notes\n`
    : `# PR Draft\n\n## Summary\n\n## Changes\n\n## Validation\n`;
  try {
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(fallbackPath, defaultContent, 'utf8');
  } catch {
    // ignore
  }
  return sanitizeTemplate(defaultContent);
}

export default { getTemplate };
