import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { spawn } from 'node:child_process';
import logger from '../utils/logger.js';

const RULES_PATH = path.join(process.cwd(), '.acommit', 'rules.yml');
const ONE_TIME_PATH = path.join(process.cwd(), '.acommit', 'last_prompt.json');

async function ensureDir() {
  const dir = path.join(process.cwd(), '.acommit');
  await fs.mkdir(dir, { recursive: true });
}

async function loadRules() {
  try {
    const raw = await fs.readFile(RULES_PATH, 'utf8');
    return YAML.parse(raw) || {};
  } catch {
    return {};
  }
}

async function saveRules(obj) {
  await ensureDir();
  const str = YAML.stringify(obj);
  await fs.writeFile(RULES_PATH, str, 'utf8');
}

function openEditorSync(initial) {
  const tmp = path.join(os.tmpdir(), `acommit-prompt-${Date.now()}.txt`);
  return new Promise(async (resolve, reject) => {
    await fs.writeFile(tmp, initial || '', 'utf8');
    const editor = process.env.EDITOR || 'vi';
    const child = spawn(editor, [tmp], { stdio: 'inherit' });
    child.on('exit', async (code) => {
      if (code !== 0) return reject(new Error('editor exit with non-zero'));
      try {
        const content = await fs.readFile(tmp, 'utf8');
        resolve(content);
      } catch (e) { reject(e); }
    });
  });
}

export async function cmdPrompt(opts = {}) {
  await ensureDir();
  let text = '';
  if (opts.message) {
    text = String(opts.message).trim();
  } else {
    try {
      text = String(await openEditorSync(''));
    } catch (e) {
      logger.error(`Failed to open editor: ${e.message}`);
      return;
    }
  }
  if (!text || !text.trim()) {
    logger.warn('Empty prompt, nothing to do.');
    return;
  }

  if (opts.save) {
    const rules = await loadRules();
    const arr = Array.isArray(rules.prompts) ? rules.prompts : [];
    arr.push({ text: text.trim(), createdAt: new Date().toISOString() });
    rules.prompts = arr;
    await saveRules(rules);
    logger.info('Saved prompt to .acommit/rules.yml under `prompts`.');
    return;
  }

  const payload = { text: text.trim(), createdAt: new Date().toISOString() };
  await fs.writeFile(ONE_TIME_PATH, JSON.stringify(payload, null, 2), 'utf8');
  logger.info('Stored one-time prompt; it will be used by the next `acommit run`.');
}

export default cmdPrompt;
