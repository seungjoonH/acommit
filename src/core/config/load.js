import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { normalize } from "./schema.js";
import logger from '../../utils/logger.js';

export async function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, ".acommit", "rules.yml");
  try {
    const raw = await fs.readFile(file, "utf8");
    const user = YAML.parse(raw) || {};
    const cfg = normalize(user);
    // provider-specific validation
    const provider = (cfg.llm && cfg.llm.provider || '').toLowerCase();
    if (provider === 'gemini') {
      const model = cfg.llm && cfg.llm.model;
      if (!model && !process.env.GEMINI_MODEL) {
        logger.error('Gemini provider requires llm.model (or set GEMINI_MODEL env).', { exit: false });
        return cfg;
      }
    }
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        logger.error('OpenAI provider selected but OPENAI_API_KEY is not set. Set OPENAI_API_KEY in your environment or .env.', { exit: false });
        return cfg;
      }
    }
    return cfg;
  } 
  catch { return normalize({}); }
}