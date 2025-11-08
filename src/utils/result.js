import fs from "node:fs/promises";
import path from "node:path";
import { nowStamp } from "./date.js";

export async function appendResult(cwd, content, { prompts = [], provider = null, model = null } = {}) {
  const dir = path.join(cwd, ".acommit", "results");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${nowStamp()}.md`);
  const promptsHeader = (Array.isArray(prompts) && prompts.length)
    ? `# Prompts\n${prompts.map((p, i) => `- ${p}`).join("\n")}\n\n---\n\n`
    : '';
  const meta = [];
  if (provider) meta.push(`Provider: ${provider}`);
  if (model) meta.push(`Model: ${model}`);
  const metaHeader = meta.length ? `# Metadata\n${meta.join("\n")}\n\n---\n\n` : '';
  await fs.appendFile(file, `\n\n${metaHeader}${promptsHeader}${content.trim()}\n`, "utf8");
  return file;
}