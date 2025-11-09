import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import YAML from 'yaml';
import logger from '../utils/logger.js';

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini (Google AI Studio)' },
  { value: 'openai', label: 'OpenAI' },
];

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

function renderList(index, current, linesPrintedRef) {
  if (linesPrintedRef.count) {
    readline.moveCursor(process.stdout, 0, -linesPrintedRef.count);
    readline.clearScreenDown(process.stdout);
  }
  const lines = PROVIDERS.map((p, idx) => {
    const cursor = idx === index ? '*' : ' ';
    const suffix = current && current === p.value ? ' (current)' : '';
    return `${cursor} ${p.value}${suffix}`;
  });
  process.stdout.write(lines.join('\n') + '\n');
  linesPrintedRef.count = lines.length;
}

async function interactiveSelect(current) {
  if (!process.stdin.isTTY) {
    logger.error('Interactive selection requires a TTY. Re-run in a terminal or use --provider <name>.');
    return null;
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  console.log('Use ↑/↓ to choose a provider, Enter to confirm, Ctrl+C to cancel.\n');

  let index = Math.max(0, PROVIDERS.findIndex((p) => p.value === current));
  if (index === -1) index = 0;
  const linesPrintedRef = { count: 0 };

  renderList(index, current, linesPrintedRef);

  return new Promise((resolve) => {
    const detach = () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', handleKey);
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const handleKey = (_str, key = {}) => {
      if (key.name === 'up') {
        index = (index - 1 + PROVIDERS.length) % PROVIDERS.length;
        renderList(index, current, linesPrintedRef);
        return;
      }
      if (key.name === 'down') {
        index = (index + 1) % PROVIDERS.length;
        renderList(index, current, linesPrintedRef);
        return;
      }
      if (key.name === 'return') {
        detach();
        resolve(PROVIDERS[index].value);
        return;
      }
      if (key.ctrl && key.name === 'c') {
        detach();
        resolve(null);
      }
    };

    process.stdin.on('keypress', handleKey);
  });
}

function validateProvider(value) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return null;
  const exists = PROVIDERS.some((p) => p.value === normalized);
  if (!exists) {
    logger.error(`Unknown provider '${value}'. Supported: ${PROVIDERS.map((p) => p.value).join(', ')}`);
    return null;
  }
  return normalized;
}

export async function modelCommand(opts = {}) {
  const rules = await loadRules();
  const current = rules?.llm?.provider || null;

  let provider = null;
  if (opts.provider) {
    provider = validateProvider(opts.provider);
    if (!provider) return;
  } else {
    provider = await interactiveSelect(current);
    if (!provider) {
      logger.warn('Selection cancelled. No changes applied.');
      return;
    }
  }

  const next = { ...rules, llm: { ...(rules.llm || {}) } };
  next.llm.provider = provider;
  await saveRules(next);

  const hint = provider === 'openai'
    ? 'Set OPENAI_API_KEY and optionally OPENAI_MODEL.'
    : 'Set GEMINI_API_KEY and optionally GEMINI_MODEL.';

  logger.info(`LLM provider set to '${provider}'. ${hint}`);
}

export default modelCommand;
