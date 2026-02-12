import fs from "node:fs/promises";
import path from "node:path";
import { nowStamp } from "./date.js";

function sanitizeSegment(value) {
  return String(value || "command")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "command";
}

function normalizeMetadata(metadata = {}) {
  const pairs = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null || value === "") continue;
    pairs.push([key, typeof value === "string" ? value : String(value)]);
  }
  return pairs;
}

export async function logPromptUsage(
  cwd,
  {
    command = "command",
    systemPrompt = "",
    userPrompt = "",
    prompts = [],
    metadata = {},
  } = {}
) {
  const baseDir = path.join(cwd, ".acommit", "results", "prompts");
  await fs.mkdir(baseDir, { recursive: true });

  const safeName = sanitizeSegment(command);
  const filePath = path.join(baseDir, `${nowStamp()}_${safeName}.md`);

  const sections = [];
  const metaEntries = normalizeMetadata({ Command: command, ...metadata });
  if (metaEntries.length) {
    const metaBody = metaEntries.map(([k, v]) => `${k}: ${v}`).join("\n");
    sections.push(`# Metadata\n${metaBody}`);
  }

  if (Array.isArray(prompts) && prompts.length) {
    sections.push(`# Extra Prompts\n${prompts.map((p) => `- ${p}`).join("\n")}`);
  }

  if (systemPrompt) {
    sections.push(`# System Prompt\n${String(systemPrompt).trimEnd()}`);
  }
  if (userPrompt) {
    sections.push(`# User Prompt\n${String(userPrompt).trimEnd()}`);
  }

  const body = sections.filter(Boolean).join("\n\n").trimEnd() + "\n";
  await fs.writeFile(filePath, body, "utf8");
  return filePath;
}

export default logPromptUsage;
