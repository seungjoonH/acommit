import fs from "node:fs/promises";
import path from "node:path";
import { nowStamp } from "./date.js";

// Migrate legacy .acommit/results/*.md into the commits/ folder
async function migrateOldResults(cwd) {
  const base = path.join(cwd, ".acommit", "results");
  try {
    const entries = await fs.readdir(base, { withFileTypes: true });
    const commitsDir = path.join(base, "commits");
    await fs.mkdir(commitsDir, { recursive: true });
    for (const e of entries) {
      if (e.isFile()) {
        const from = path.join(base, e.name);
        const to = path.join(commitsDir, e.name);
        try { await fs.rename(from, to); } catch { /* ignore collisions */ }
      }
    }
  } catch {
    // Missing directory
  }
}

export async function appendResult(
  cwd,
  content,
  {
    prompts = [],
    provider = null,
    model = null,
  } = {}
) {
  const base = path.join(cwd, ".acommit", "results");
  await fs.mkdir(base, { recursive: true });
  await migrateOldResults(cwd);

  const dir = path.join(base, "commits");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${nowStamp()}.md`);

  const promptsHeader = (Array.isArray(prompts) && prompts.length)
    ? `# Prompts\n${prompts.map((p) => `- ${p}`).join("\n")}\n\n---\n\n`
    : '';
  const meta = [];
  if (provider) meta.push(`Provider: ${provider}`);
  if (model) meta.push(`Model: ${model}`);
  const metaHeader = meta.length ? `# Metadata\n${meta.join("\n")}\n\n---\n\n` : '';
  await fs.appendFile(file, `\n\n${metaHeader}${promptsHeader}${content.trim()}\n`, "utf8");
  return file;
}
