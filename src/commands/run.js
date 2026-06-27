import chalk from "chalk";
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { DiffCollector } from "../core/diff/collector.js";
import { loadConfig } from "../core/config/load.js";
import { buildPromptFromDiff } from "../core/prompt/build.js";
import { groupFilePaths } from "../core/grouping/group.js";
import {
  validateCommitPlan,
  formatValidationErrors,
  perGroupOutputTokenCap,
} from "../core/grouping/validate.js";
import createLLMClient from "../core/llm/index.js";
import { ProgressUI } from "../ui/progress.js";
import { saveSession } from "../utils/result.js";
import { parseCommitText } from "../utils/parseCommitText.js";
import { nowStamp } from "../utils/date.js";
import { readLocale } from "../core/locale.js";
import { initStrings } from "../ui/init-i18n.js";
import { ensureWebBuild } from "../utils/webBuild.js";
import { startServer } from "../web/server.js";
import logger from '../utils/logger.js';

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

async function collectLocalDiff(cwd, cfg, ui, t) {
  const dc = new DiffCollector({
    cwd,
    skip: cfg.diff?.skip ?? [],
    omitContent: cfg.diff?.omitContent ?? [],
    untrackedSizeLimit: cfg.diff?.untrackedSizeLimit,
  });
  const files = await dc.listFiles();
  if (!files.length) return { files, diffByFile: new Map() };

  ui.info(`\n[acommit] ${t.cli.processing(files.length)}\n`);
  ui.startFiles(files.length);
  const diffByFile = new Map();
  for (const fp of files) {
    diffByFile.set(fp, await dc.render(fp));
    ui.tickFile(fp);
  }
  ui.endFiles();
  return { files, diffByFile };
}

function llmLabel(cfg) {
  const provider = cfg.llm?.provider ?? 'gemini';
  const model = cfg.llm?.model;
  return model ? `${provider} / ${model}` : provider;
}

async function ensureClient(cfg, ui, t) {
  const label = llmLabel(cfg);
  ui.startSpinner(t.cli.initClient(label));
  const provider = (cfg.llm && cfg.llm.provider) || 'gemini';
  const client = await createLLMClient(provider, { model: cfg.llm && cfg.llm.model });
  ui.stopSpinner(client ? t.cli.ready : t.cli.failed);
  if (!client) {
    const pkgByProvider = { openai: 'openai', openrouter: 'openai', gemini: '@google/generative-ai' };
    const pkg = pkgByProvider[provider] || pkgByProvider.gemini;
    logger.error(t.cli.initFailed(provider, pkg), { exit: false });
    return null;
  }
  return { provider, client };
}

function determineModelUsed(cfg) {
  return cfg.llm?.model ?? null;
}

function diffTextForGroup(diffByFile, group) {
  return group.map((fp) => diffByFile.get(fp) ?? '').join('');
}

function buildGroupPlans(cfg, groups, diffByFile, extraPrompts) {
  return groups.map((group) => {
    const groupDiff = diffTextForGroup(diffByFile, group);
    const built = buildPromptFromDiff(
      cfg,
      groupDiff,
      extraPrompts,
      { perGroup: true, groupFiles: group },
    );
    return { group, ...built };
  });
}

export async function run() {
  const cwd = process.cwd();
  const ui = new ProgressUI();
  const cfg = await loadConfig(cwd);
  const locale = await readLocale(cwd);
  const t = initStrings(locale);
  const { extraPrompts, promptsForResult } = await loadPrompts(cwd, cfg);

  const { files, diffByFile } = await collectLocalDiff(cwd, cfg, ui, t);
  if (!files.length) return ui.note(`[acommit] ${t.cli.noChanges}`);

  const groups = groupFilePaths(files, cfg);
  const plans = buildGroupPlans(cfg, groups, diffByFile, extraPrompts);
  const validation = validateCommitPlan(groups, cfg, {
    promptTokens: plans.map((p) => p.approxTokens),
  });

  if (!validation.ok) {
    logger.error(
      `Cannot generate commits safely (${files.length} files, ${groups.length} groups).\n`
      + `${formatValidationErrors(validation.issues)}\n`
      + 'Fix rules.yml or stage fewer files — no LLM request was sent.',
      { exit: false },
    );
    return;
  }

  const clientInfo = await ensureClient(cfg, ui, t);
  if (!clientInfo) return ui.note(`[acommit] ${t.cli.noClient}`);
  const { provider, client } = clientInfo;
  const gen = client.gen;
  const modelUsed = determineModelUsed(cfg);
  const outputCap = perGroupOutputTokenCap(cfg);
  const llm = llmLabel(cfg);

  ui.info(`[acommit] ${t.cli.using(llm, plans.length)}`);

  const sessionId = nowStamp();
  const commits = [];
  let totalApproxTokens = 0;

  for (let i = 0; i < plans.length; i++) {
    const { group, system, user, approxTokens } = plans[i];
    totalApproxTokens += approxTokens;

    ui.startSpinner(t.cli.generating(i + 1, plans.length));
    const out = await gen(user, { system, maxTokens: outputCap });
    const text = (out?.text ?? '').trim();
    if (!text) {
      ui.stopSpinner(t.cli.failed);
      const errMsg = out?.raw?.error || out?.raw || 'Unknown LLM error';
      const suggestion = out?.raw?.suggestion;
      const detail = suggestion ? `${errMsg} — ${suggestion}` : String(errMsg);
      logger.error(t.cli.groupFailed(i + 1, detail), { exit: false });
      return;
    }
    ui.stopSpinner(t.cli.done);

    const parsed = parseCommitText(text, group, cfg);
    commits.push(parsed);
    console.log('\n' + text + '\n');
  }

  console.log(chalk.yellow(`[acommit] ${t.cli.tokens}`), totalApproxTokens);

  const session = {
    id: sessionId,
    timestamp: new Date().toISOString(),
    provider,
    model: modelUsed,
    groupingMode: cfg.grouping?.mode ?? 'per-file',
    tagStyle: cfg.tags?.style ?? '{tag}',
    tagSeparator: cfg.tags?.separator ?? ': ',
    prompts: promptsForResult,
    commits,
  };

  const saved = await saveSession(cwd, session);
  ui.note(`[acommit] ${t.cli.saved(saved)}\n`);

  // Open result viewer
  await ensureWebBuild().catch(() => {});
  const { server, port: actualPort } = await startServer(cwd).catch(() => ({ server: null, port: null }));
  if (!server) return;

  const url = `http://localhost:${actualPort}/result`;
  logger.info(`[acommit] result  →  ${url}`);

  const openCmd = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;
  exec(openCmd, () => {});

  logger.info('[acommit] Press Ctrl+C to stop.');
  await new Promise((resolve) => {
    let shuttingDown = false;
    const finish = () => { resolve(); process.exit(0); };
    const shutdown = () => {
      if (shuttingDown) { finish(); return; }
      shuttingDown = true;
      logger.info('Shutting down…');
      server.closeAllConnections?.();
      server.close(() => finish());
      setTimeout(finish, 1500);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
