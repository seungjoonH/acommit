import fs from "node:fs/promises";
import path from "node:path";
import { nowStamp } from "./date.js";

// Result persistence helper
// - Uses `.acommit/results/commits/`, `.acommit/results/issues/<num>/`, `.acommit/results/prs/<num>/`, `.acommit/results/prs/new/`
// - Migrates legacy `.acommit/results/*.md` files into the `commits` folder once
async function migrateOldResults(cwd) {
  const base = path.join(cwd, ".acommit", "results");
  try {
    const entries = await fs.readdir(base, { withFileTypes: true });
    const commitsDir = path.join(base, "commits");
    await fs.mkdir(commitsDir, { recursive: true });
    for (const e of entries) {
      // Plain file migration
      if (e.isFile()) {
        const from = path.join(base, e.name);
        const to = path.join(commitsDir, e.name);
        try {
          await fs.rename(from, to);
        } catch (err) {
          // Ignore collisions
        }
      }
    }
  } catch (e) {
    // Missing directory
  }
}

export async function appendResult(
  cwd,
  content,
  {
    type = 'commit',
    number = null,
    prompts = [],
    provider = null,
    model = null,
    metadata = {},
  } = {}
) {
  // Storage directory selection
  const base = path.join(cwd, ".acommit", "results");
  // Legacy migration guard
  await fs.mkdir(base, { recursive: true });
  await migrateOldResults(cwd);

  let dir;
  if (type === 'issue') {
    if (!number) throw new Error('issue type needs number');
    dir = path.join(base, 'issues', String(number));
  } else if (type === 'pr') {
    const prFolder = number ? String(number) : 'new';
    dir = path.join(base, 'prs', prFolder);
  } else {
    dir = path.join(base, 'commits');
  }

  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${nowStamp()}.md`);

  const promptsHeader = (Array.isArray(prompts) && prompts.length)
    ? `# Prompts\n${prompts.map((p, i) => `- ${p}`).join("\n")}\n\n---\n\n`
    : '';
  const meta = [];
  if (provider) meta.push(`Provider: ${provider}`);
  if (model) meta.push(`Model: ${model}`);
  if (type) meta.push(`Type: ${type}`);
  if (number) meta.push(`Number: ${number}`);
  if (metadata && typeof metadata === 'object') {
    for (const [k, v] of Object.entries(metadata)) {
      if (v == null || v === '') continue;
      meta.push(`${k}: ${v}`);
    }
  }
  const metaHeader = meta.length ? `# Metadata\n${meta.join("\n")}\n\n---\n\n` : '';
  await fs.appendFile(file, `\n\n${metaHeader}${promptsHeader}${content.trim()}\n`, "utf8");
  return file;
}
