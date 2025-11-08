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
    const suffix = current && current === p.value ? ' (현재)' : '';
    return `${cursor} ${p.value}${suffix}`;
  });
  process.stdout.write(lines.join('\n') + '\n');
  linesPrintedRef.count = lines.length;
}

async function interactiveSelect(current) {
  if (!process.stdin.isTTY) {
    logger.error('상호작용 선택은 TTY 환경에서만 가능합니다. 터미널에서 다시 실행하거나 --provider <name> 옵션을 사용하세요.');
    return null;
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  console.log('↑/↓ 로 제공자를 고르고 Enter 로 확정합니다. 취소는 Ctrl+C 입니다.\n');

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
    logger.error(`알 수 없는 제공자 '${value}' 입니다. 지원 목록: ${PROVIDERS.map((p) => p.value).join(', ')}`);
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
      logger.warn('선택이 취소되어 변경 사항이 없습니다.');
      return;
    }
  }

  const next = { ...rules, llm: { ...(rules.llm || {}) } };
  next.llm.provider = provider;
  await saveRules(next);

  const hint = provider === 'openai'
    ? 'OPENAI_API_KEY 와 (선택적으로) OPENAI_MODEL 환경 변수를 설정하세요.'
    : 'GEMINI_API_KEY 와 (선택적으로) GEMINI_MODEL 환경 변수를 설정하세요.';

  logger.info(`LLM 제공자를 '${provider}' 로 설정했습니다. ${hint}`);
}

export default modelCommand;
