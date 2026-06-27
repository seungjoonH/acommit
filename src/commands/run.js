import chalk from "chalk";
import { DiffCollector } from "../core/diff/collector.js";
import { loadConfig } from "../core/config/load.js";
import { buildPromptFromDiff } from "../core/prompt/build.js";
import createLLMClient from "../core/llm/index.js";
import { ProgressUI } from "../ui/progress.js";
import { appendResult } from "../utils/result.js";
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../utils/logger.js';
import { logPromptUsage } from '../utils/prompt-log.js';

async function loadPrompts(cwd, cfg) {
  const oneTimePath = path.join(cwd, '.acommit', 'last_prompt.json');
  let extraPrompts = [];
  try {
    const raw = await fs.readFile(oneTimePath, 'utf8');
    const j = JSON.parse(raw);
    if (j && j.text) {
      extraPrompts = [{ text: String(j.text), source: 'one-time' }];
      await fs.unlink(oneTimePath).catch(() => {});
    }
  } catch {
    // ignore
  }
  if (!extraPrompts.length && Array.isArray(cfg.prompts) && cfg.prompts.length) {
    extraPrompts = cfg.prompts.map((p) => ({
      text: p.text || String(p),
      source: 'persistent',
    }));
  }
  const promptsForResult = extraPrompts.map((p) => `[${p.source}] ${p.text}`);
  return { extraPrompts, promptsForResult };
}

async function collectLocalDiff(cwd, ui) {
  const dc = new DiffCollector({ cwd });
  const files = await dc.listFiles();
  if (!files.length) return { files, diffText: "" };

  ui.info(`\n[acommit] Processing ${files.length} changed files...\n`);
  ui.startFiles(files.length);
  let diffText = "";
  for (const fp of files) {
    diffText += await dc.render(fp);
    ui.tickFile(fp);
  }
  ui.endFiles();
  return { files, diffText };
}

async function ensureClient(cfg, ui) {
  ui.startSpinner("Initializing LLM client...");
  const provider = (cfg.llm && cfg.llm.provider) || 'gemini';
  const client = await createLLMClient(provider, { model: cfg.llm && cfg.llm.model });
  ui.stopSpinner(client ? 'ready.' : 'failed');
  if (!client) {
    const pkg = provider === 'openai' ? 'openai' : '@google/generative-ai';
    const envExample = provider === 'openai'
      ? 'export OPENAI_API_KEY="<key>"; export OPENAI_MODEL="gpt-4o"'
      : 'export GEMINI_API_KEY="<key>"; export GEMINI_MODEL="gemini-2.5-flash"';
    logger.error(
      `Failed to initialize LLM provider '${provider}'. Install the SDK (npm install ${pkg}) and set env vars (e.g., ${envExample}).`,
      { exit: false }
    );
    return null;
  }
  return { provider, client };
}

function determineModelUsed(cfg, provider) {
  return (cfg.llm && cfg.llm.model)
    || (provider === 'gemini' ? process.env.GEMINI_MODEL : process.env.OPENAI_MODEL)
    || null;
}

function makePromptLogger({ cwd, promptsForResult, provider, modelUsed }) {
  return async function recordPrompt({
    command = 'commit',
    systemPrompt = '',
    userPrompt = '',
    tokensEstimate = null,
    metadata = {},
  } = {}) {
    const combinedMeta = {
      Provider: provider || undefined,
      Model: modelUsed || undefined,
      TokensEstimate: tokensEstimate,
      ...metadata,
    };
    try {
      await logPromptUsage(cwd, {
        command,
        systemPrompt,
        userPrompt,
        prompts: promptsForResult,
        metadata: combinedMeta,
      });
    } catch (err) {
      logger.verbose(`[acommit] prompt log skipped: ${String(err.message)}`);
    }
  };
}

export async function run() {
  const cwd = process.cwd();
  const ui = new ProgressUI();
  const cfg = await loadConfig(cwd);
  const { extraPrompts, promptsForResult } = await loadPrompts(cwd, cfg);
  const clientInfo = await ensureClient(cfg, ui);
  if (!clientInfo) return ui.note('[acommit] No LLM client is available.');
  const { provider, client } = clientInfo;
  const gen = client.gen;
  const modelUsed = determineModelUsed(cfg, provider);
  const logPrompt = makePromptLogger({ cwd, promptsForResult, provider, modelUsed });

  // Collect diff
  const { files, diffText } = await collectLocalDiff(cwd, ui);
  if (!files.length) return ui.note("[acommit] No changes detected");

  // Build prompt
  const { system, user, approxTokens } = buildPromptFromDiff(cfg, diffText, extraPrompts);
  await logPrompt({
    command: 'commit',
    systemPrompt: system,
    userPrompt: user,
    tokensEstimate: approxTokens,
  });

  // Request LLM
  ui.startSpinner("Requesting LLM...");
  const out = await gen(`${system}\n\n${user}`, { maxTokens: cfg.llm && cfg.llm.maxOutputTokens });
  ui.stopSpinner('done.');

  logger.verbose('[acommit] debug: outObj from LLM:');
  try {
    logger.verbose(JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[Function]' : v), 2));
  } catch (e) {
    logger.verbose(String(out));
  }

  const answer = (out && out.text) ? String(out.text).trim() : '';
  console.log(chalk.yellow("[acommit] Estimated prompt tokens:"), approxTokens);
  if (!answer) {
    const errMsg = out?.raw?.error || out?.raw || 'Unknown LLM error';
    ui.note(`[acommit] LLM did not return an answer. Error: ${String(errMsg)}`);
    return;
  }

  // Output and save
  console.log("\n" + answer + "\n");
  const saved = await appendResult(cwd, answer, {
    prompts: promptsForResult,
    provider,
    model: modelUsed,
  });
  ui.note(`[acommit] Result saved at: ${saved}\n`);
}
