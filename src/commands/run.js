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

export async function run() {
  const cwd = process.cwd();
  const dc  = new DiffCollector({ cwd });
  const ui  = new ProgressUI();

  const files = await dc.listFiles();
  if (files.length === 0) return ui.note("[acommit] No changes detected");

  ui.info(`\n[acommit] Processing ${files.length} changed files...\n`);
  ui.startFiles(files.length);

  let diffText = "";
  for (const fp of files) {
    diffText += await dc.render(fp);
    ui.tickFile(fp);
  }
  ui.endFiles();

  const cfg = await loadConfig(cwd);
  const oneTimePath = path.join(cwd, '.acommit', 'last_prompt.json');
  let extraPrompts = [];
  try {
    const raw = await fs.readFile(oneTimePath, 'utf8');
    const j = JSON.parse(raw);
    if (j && j.text) {
      extraPrompts = [{ text: String(j.text), source: 'one-time' }];
      // remove after consuming
      await fs.unlink(oneTimePath).catch(() => {});
    }
  } catch (e) {
    // ignore missing file
  }
  // if no one-time, use persistent prompts from config
  if (!extraPrompts.length && Array.isArray(cfg.prompts) && cfg.prompts.length) {
    extraPrompts = cfg.prompts.map(p => ({ text: p.text || String(p), source: 'persistent' }));
  }

  const { system, user, approxTokens } = buildPromptFromDiff(cfg, diffText, extraPrompts);

  ui.startSpinner("Requesting LLM...");
  const provider = (cfg.llm && cfg.llm.provider) || 'gemini';
  const client = await createLLMClient(provider, { model: cfg.llm && cfg.llm.model });
  if (!client) {
    ui.stopSpinner('failed');
    const pkg = provider === 'openai' ? 'openai' : '@google/generative-ai';
    const envExample = provider === 'openai'
      ? 'export OPENAI_API_KEY="<key>"; export OPENAI_MODEL="gpt-4o"'
      : 'export GEMINI_API_KEY="<key>"; export GEMINI_MODEL="gemini-2.5-flash"';
    logger.error(
      `LLM 제공자 '${provider}' 를 초기화할 수 없습니다. SDK 설치 및 환경 변수 설정을 확인하세요. 예: npm install ${pkg} / ${envExample}`,
      { exit: false }
    );
    return ui.note('[acommit] 사용할 수 있는 LLM 클라이언트가 없습니다.');
  }
  const { gen } = client;
  const outObj = await gen(`${system}\n\n${user}`, { maxTokens: cfg.llm && cfg.llm.maxOutputTokens });
  ui.stopSpinner("done.");

  // debug: dump outObj for inspection at VERBOSE level only
  logger.verbose('[acommit] debug: outObj from LLM:');
  try {
    logger.verbose(JSON.stringify(outObj, (_k, v) => (typeof v === 'function' ? '[Function]' : v), 2));
  } catch (e) {
    // fallback to a coarse string representation
    logger.verbose(String(outObj));
  }

  const answer = (outObj && outObj.text) ? String(outObj.text).trim() : '';
  console.log(chalk.yellow("[acommit] Estimated prompt tokens:"), approxTokens);

  if (!answer) {
    const errMsg = outObj?.raw?.error || outObj?.raw || 'Unknown LLM error';
    ui.note(`[acommit] LLM did not return an answer. Error: ${String(errMsg)}`);
    return;
  }

  console.log("\n" + answer + "\n");

  const promptsForResult = (extraPrompts || []).map(p => `[${p.source}] ${p.text}`);
  const modelUsed = (cfg.llm && cfg.llm.model) || (provider === 'gemini' ? process.env.GEMINI_MODEL : process.env.OPENAI_MODEL) || null;
  const saved = await appendResult(cwd, answer, { prompts: promptsForResult, provider, model: modelUsed });
  ui.note(`[acommit] Result saved at: ${saved}\n`);
}
