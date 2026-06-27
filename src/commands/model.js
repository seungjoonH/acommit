import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  isRuntimeProvider,
  parseLlmConfig,
  resolveLlmConfig,
  apiKeyHint,
} from '../core/llm/catalog.js';
import { readLocale } from '../core/locale.js';
import { pickLlmConfig } from '../ui/llm-pick.js';
import { initStrings } from '../ui/init-i18n.js';
import { createTuiSession, pc } from '../ui/tui.js';
import logger from '../utils/logger.js';

const RULES_DIR = path.join(process.cwd(), '.acommit');
const RULES_PATH = path.join(RULES_DIR, 'rules.yml');

async function ensureRulesDir() {
  await fs.mkdir(RULES_DIR, { recursive: true });
}

async function loadRules() {
  try {
    const raw = await fs.readFile(RULES_PATH, 'utf8');
    return YAML.parse(raw) || {};
  } catch {
    return {};
  }
}

async function saveRules(rules) {
  await ensureRulesDir();
  const serialized = YAML.stringify(rules);
  await fs.writeFile(RULES_PATH, serialized, 'utf8');
}

function validateLlmFlags({ provider, model }) {
  if (provider && !isRuntimeProvider(provider)) {
    logger.error(`Unknown provider '${provider}'. Supported: gemini, openai, openrouter`);
    return null;
  }
  if (!provider) return null;
  if (model) return { provider: provider.toLowerCase(), model };
  return resolveLlmConfig(parseLlmConfig({ provider }));
}

export async function modelCommand(opts = {}) {
  const rules = await loadRules();
  const current = rules?.llm || {};
  const locale = await readLocale();
  const t = initStrings(locale);

  let llm = null;
  if (opts.provider || opts.model) {
    llm = validateLlmFlags({ provider: opts.provider, model: opts.model });
    if (!llm) return;
  } else if (process.stdin.isTTY) {
    const tui = createTuiSession(t.modelCmd.title);
    llm = await pickLlmConfig({
      session: tui,
      labels: t.llmPick,
      current,
    });
    if (!llm) {
      tui.cancel(t.modelCmd.cancel);
      return;
    }

    const next = { ...rules, llm: { ...(rules.llm || {}), ...llm } };
    await saveRules(next);

    const hint = apiKeyHint(llm);
    const summary = `${llm.provider} / ${llm.model}. ${hint}`;
    tui.finish(pc.green(`LLM → ${summary}`));
    return;
  } else {
    logger.error('Interactive selection requires a TTY. Use --provider and --model.');
    return;
  }

  const next = { ...rules, llm: { ...(rules.llm || {}), ...llm } };
  await saveRules(next);

  const hint = apiKeyHint(llm);
  const summary = `${llm.provider} / ${llm.model}. ${hint}`;
  logger.info(`LLM set to ${summary}`);
}

export default modelCommand;
