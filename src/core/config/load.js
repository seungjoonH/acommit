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
