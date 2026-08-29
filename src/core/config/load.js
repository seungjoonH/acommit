import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { normalize } from "./schema.js";
import { env } from '../../utils/env.js';
import logger from '../../utils/logger.js';

export async function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, ".acommit", "rules.yml");
  try {
    const raw = await fs.readFile(file, "utf8");
    const user = YAML.parse(raw) || {};
    const cfg = normalize(user);
    const provider = (cfg.llm && cfg.llm.provider || '').toLowerCase();
    if (provider === 'gemini') {
      const model = cfg.llm && cfg.llm.model;
      if (!model && !env('GEMINI_MODEL')) {
        logger.error('Gemini provider requires llm.model (or set GEMINI_MODEL / ACOMMIT_GEMINI_MODEL in .env).', { exit: false });
        return cfg;
      }
    }
    if (provider === 'openai') {
      if (!env('OPENAI_API_KEY')) {
        logger.error('OpenAI provider selected but OPENAI_API_KEY is not set. Add OPENAI_API_KEY or ACOMMIT_OPENAI_API_KEY to .env.', { exit: false });
        return cfg;
      }
    }
    if (provider === 'openrouter') {
      if (!env('OPENROUTER_API_KEY')) {
        logger.error('OpenRouter provider selected but OPENROUTER_API_KEY is not set. Add OPENROUTER_API_KEY or ACOMMIT_OPENROUTER_API_KEY to .env.', { exit: false });
        return cfg;
      }
    }
    return cfg;
  }
  catch { return normalize({}); }
}

function deepMerge(target, patch) {
  const out = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = (value && typeof value === "object" && !Array.isArray(value))
      ? deepMerge(target?.[key] && typeof target[key] === "object" ? target[key] : {}, value)
      : value;
  }
  return out;
}

// Merge a partial patch into the raw rules.yml (not the normalized/defaulted
// config), so fields the user hasn't set stay absent from the file.
export async function saveConfig(cwd, patch) {
  const dir = path.join(cwd, ".acommit");
  const file = path.join(dir, "rules.yml");
  let raw = {};
  try {
    raw = YAML.parse(await fs.readFile(file, "utf8")) || {};
  } catch {
    // no existing rules.yml — start fresh
  }
  const merged = deepMerge(raw, patch);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, YAML.stringify(merged), "utf8");
  return normalize(merged);
}
