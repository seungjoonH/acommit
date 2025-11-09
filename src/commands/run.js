import chalk from "chalk";
import { DiffCollector } from "../core/diff/collector.js";
import { loadConfig } from "../core/config/load.js";
import { buildPromptFromDiff } from "../core/prompt/build.js";
import createLLMClient from "../core/llm/index.js";
import { ProgressUI } from "../ui/progress.js";
import { appendResult } from "../utils/result.js";
import { getTemplate } from "../utils/template.js";
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import logger from '../utils/logger.js';

const execp = promisify(exec);

function normalizeRemoteUrl(raw = "") {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("git@")) {
    const match = trimmed.match(/^git@([^:]+):(.+?)(\.git)?$/);
    if (!match) return null;
    return `https://${match[1]}/${match[2]}`;
  }
  if (trimmed.startsWith("ssh://")) {
    const withoutProto = trimmed.replace(/^ssh:\/\//, "");
    const match = withoutProto.match(/^[^@]+@([^:\/]+)[:\/](.+?)(\.git)?$/);
    if (!match) return null;
    return `https://${match[1]}/${match[2]}`;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.replace(/\.git$/, "");
  }
  return null;
}

async function getRepoWebUrl(cwd) {
  try {
    const { stdout } = await execp("git config --get remote.origin.url", { cwd });
    return normalizeRemoteUrl(stdout);
  } catch {
    return null;
  }
}

function appendLinkFooter(markdown, label, url) {
  if (!url) return markdown;
  if (markdown.includes(url)) return markdown;
  const trimmed = markdown.trimEnd();
  return `${trimmed}\n\n[${label}](${url})\n`;
}

function buildResourceUrl(repoUrl, kind, number) {
  if (!repoUrl || !number) return null;
  const base = repoUrl.replace(/\/$/, '');
  if (kind === 'issue') return `${base}/issues/${number}`;
  if (kind === 'pr') return `${base}/pull/${number}`;
  return null;
}

function replaceIssuePlaceholders(markdown, issueId, issueUrl = null) {
  if (!issueId) return markdown;
  let out = markdown.replace(/#123/g, `#${issueId}`);
  if (issueUrl) {
    out = out.replace(/\(#\)/g, `(${issueUrl})`);
  }
  return out;
}

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

async function runCmd(cwd, cmd) {
  try {
    const { stdout, stderr } = await execp(cmd, { cwd });
    if (stderr) logger.verbose('[acommit] cmd stderr: ' + String(stderr));
    return String(stdout || '').trim();
  } catch (e) {
    throw new Error(`command failed: ${cmd}\n${e.stdout || e.message}`);
  }
}

async function generateWithTemplate({ cfg, diffText, extraPrompts, purpose, template, linkedIssueId, gen, ui, spinnerLabel }) {
  const prompt = buildPromptFromDiff(cfg, diffText, extraPrompts, { purpose, template, linkedIssueId });
  ui.startSpinner(spinnerLabel);
  const out = await gen(`${prompt.system}\n\n${prompt.user}`, { maxTokens: cfg.llm && cfg.llm.maxOutputTokens });
  ui.stopSpinner('done.');
  const text = (out && out.text) ? String(out.text).trim() : '';
  return { text, approxTokens: prompt.approxTokens };
}

function ensureLinkedReference(markdown, issueId) {
  if (!issueId) return markdown;
  const ref = `#${issueId}`;
  if (markdown.includes(ref)) return markdown;
  const headerRegex = /(##[^\n]*Linked Issues[^\n]*\n)/i;
  if (headerRegex.test(markdown)) {
    return markdown.replace(headerRegex, `$1- resolves ${ref}\n`);
  }
  return `${markdown}\n\n## Linked Issues\n- resolves ${ref}\n`;
}

// run(mode, id)
export async function run(modeArg, id) {
  const mode = (typeof modeArg === 'string' && modeArg.trim())
    ? modeArg.trim().toLowerCase()
    : 'commit';
  const cwd = process.cwd();
  const repoWebUrl = await getRepoWebUrl(cwd);
  const ui = new ProgressUI();
  const cfg = await loadConfig(cwd);
  const { extraPrompts, promptsForResult } = await loadPrompts(cwd, cfg);
  const clientInfo = await ensureClient(cfg, ui);
  if (!clientInfo) return ui.note('[acommit] No LLM client is available.');
  const { provider, client } = clientInfo;
  const gen = client.gen;
  const modelUsed = determineModelUsed(cfg, provider);

  const ctx = {
    cwd,
    cfg,
    repoWebUrl,
    extraPrompts,
    promptsForResult,
    provider,
    modelUsed,
    gen,
    ui,
  };

  if (mode === 'commit') return handleCommit(ctx);
  if (mode === 'pr') return handlePr(ctx, id);
  if (mode === 'issue') return handleIssue(ctx, id);

  return ui.note(`[acommit] Unknown mode: ${mode}`);
}

async function handleCommit(ctx) {
  const { files, diffText } = await collectLocalDiff(ctx.cwd, ctx.ui);
  if (!files.length) return ctx.ui.note("[acommit] No changes detected");

  const { system, user, approxTokens } = buildPromptFromDiff(ctx.cfg, diffText, ctx.extraPrompts);
  ctx.ui.startSpinner("Requesting LLM...");
  const out = await ctx.gen(`${system}\n\n${user}`, { maxTokens: ctx.cfg.llm && ctx.cfg.llm.maxOutputTokens });
  ctx.ui.stopSpinner('done.');

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
    ctx.ui.note(`[acommit] LLM did not return an answer. Error: ${String(errMsg)}`);
    return;
  }

  console.log("\n" + answer + "\n");
  const saved = await appendResult(ctx.cwd, answer, {
    type: 'commit',
    prompts: ctx.promptsForResult,
    provider: ctx.provider,
    model: ctx.modelUsed,
  });
  ctx.ui.note(`[acommit] Result saved at: ${saved}\n`);
}

async function handlePr(ctx, prNumber) {
  if (!prNumber) return handleLocalPrDraft(ctx);
  ctx.ui.info(`[acommit] Gathering diff for PR #${prNumber} ...`);
  let diffText;
  try {
    diffText = await runCmd(ctx.cwd, `gh pr diff ${prNumber}`);
  } catch (e) {
    return ctx.ui.note(`[acommit] gh pr diff failed: ${String(e.message)}`);
  }

  const prTemplate = await getTemplate(ctx.cwd, 'pr');
  const { text: prText, approxTokens } = await generateWithTemplate({
    cfg: ctx.cfg,
    diffText,
    extraPrompts: ctx.extraPrompts,
    purpose: 'pr',
    template: prTemplate,
    gen: ctx.gen,
    ui: ctx.ui,
    spinnerLabel: 'Requesting LLM for PR content...',
  });
  if (!prText) return ctx.ui.note('[acommit] LLM did not return PR content.');
  logger.verbose(`[acommit] PR prompt tokens ≈ ${approxTokens}`);

  const prUrl = buildResourceUrl(ctx.repoWebUrl, 'pr', prNumber);
  const prContent = appendLinkFooter(prText, `PR #${prNumber}`, prUrl);
  const savedPr = await appendResult(ctx.cwd, prContent, {
    type: 'pr',
    number: prNumber,
    prompts: ctx.promptsForResult,
    provider: ctx.provider,
    model: ctx.modelUsed,
    metadata: { 'PR-URL': prUrl },
  });
  ctx.ui.note(`[acommit] Saved PR draft: ${savedPr}\n`);
}

async function handleLocalPrDraft(ctx) {
  const { files, diffText } = await collectLocalDiff(ctx.cwd, ctx.ui);
  if (!files.length) return ctx.ui.note("[acommit] No changes detected");

  const prTemplate = await getTemplate(ctx.cwd, 'pr');
  const { text: prText, approxTokens } = await generateWithTemplate({
    cfg: ctx.cfg,
    diffText,
    extraPrompts: ctx.extraPrompts,
    purpose: 'pr',
    template: prTemplate,
    gen: ctx.gen,
    ui: ctx.ui,
    spinnerLabel: 'Requesting LLM for PR content...',
  });
  if (!prText) return ctx.ui.note('[acommit] LLM did not return PR content.');
  logger.verbose(`[acommit] PR prompt tokens ≈ ${approxTokens}`);

  const savedPr = await appendResult(ctx.cwd, prText, {
    type: 'pr',
    prompts: ctx.promptsForResult,
    provider: ctx.provider,
    model: ctx.modelUsed,
  });
  ctx.ui.note(`[acommit] Saved PR draft: ${savedPr}\n`);
}

async function handleIssue(ctx, issueId) {
  if (!issueId) return ctx.ui.note('[acommit] Issue command requires an issue number (e.g., acommit issue 3)');
  ctx.ui.info(`[acommit] Resolving PRs closed by issue #${issueId} ...`);

  let prListRaw;
  try {
    const out = await runCmd(ctx.cwd, `gh issue view ${issueId} --json closedByPullRequestsReferences`);
    try {
      const j = JSON.parse(out);
      const refs = j?.closedByPullRequestsReferences || [];
      prListRaw = refs.map((r) => r.number);
    } catch {
      prListRaw = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => !Number.isNaN(n));
    }
  } catch (e) {
    return ctx.ui.note(`[acommit] gh issue view failed: ${String(e.message)}`);
  }

  if (!prListRaw || !prListRaw.length) {
    return ctx.ui.note(`[acommit] No PRs linked to issue #${issueId}.`);
  }
  const prNumber = prListRaw[0];
  ctx.ui.info(`[acommit] Issue #${issueId} → PR #${prNumber}`);

  let diffText;
  try {
    diffText = await runCmd(ctx.cwd, `gh pr diff ${prNumber}`);
  } catch (e) {
    return ctx.ui.note(`[acommit] gh pr diff failed: ${String(e.message)}`);
  }

  const issueTemplate = await getTemplate(ctx.cwd, 'issue');
  const issueGen = await generateWithTemplate({
    cfg: ctx.cfg,
    diffText,
    extraPrompts: ctx.extraPrompts,
    purpose: 'issue',
    template: issueTemplate,
    gen: ctx.gen,
    ui: ctx.ui,
    spinnerLabel: 'Requesting LLM for Issue content...',
  });
  if (!issueGen.text) return ctx.ui.note('[acommit] LLM did not return Issue content.');
  logger.verbose(`[acommit] Issue prompt tokens ≈ ${issueGen.approxTokens}`);

  const issueUrl = buildResourceUrl(ctx.repoWebUrl, 'issue', issueId);
  let issueContent = replaceIssuePlaceholders(issueGen.text, issueId, issueUrl);
  issueContent = appendLinkFooter(issueContent, `Issue #${issueId}`, issueUrl);
  const savedIssue = await appendResult(ctx.cwd, issueContent, {
    type: 'issue',
    number: issueId,
    prompts: ctx.promptsForResult,
    provider: ctx.provider,
    model: ctx.modelUsed,
    metadata: { 'Issue-URL': issueUrl },
  });

  const prTemplate = await getTemplate(ctx.cwd, 'pr');
  const prGen = await generateWithTemplate({
    cfg: ctx.cfg,
    diffText,
    extraPrompts: ctx.extraPrompts,
    purpose: 'pr',
    template: prTemplate,
    linkedIssueId: issueId,
    gen: ctx.gen,
    ui: ctx.ui,
    spinnerLabel: 'Requesting LLM for PR content...',
  });
  if (!prGen.text) return ctx.ui.note('[acommit] LLM did not return PR content.');
  logger.verbose(`[acommit] PR prompt tokens ≈ ${prGen.approxTokens}`);

  const issueUrlForMeta = issueUrl;
  let prText = replaceIssuePlaceholders(prGen.text, issueId, issueUrlForMeta);
  prText = ensureLinkedReference(prText, issueId);
  const prUrl = buildResourceUrl(ctx.repoWebUrl, 'pr', prNumber);
  const prContent = appendLinkFooter(prText, `PR #${prNumber}`, prUrl);
  const savedPr = await appendResult(ctx.cwd, prContent, {
    type: 'pr',
    number: prNumber,
    prompts: ctx.promptsForResult,
    provider: ctx.provider,
    model: ctx.modelUsed,
    metadata: {
      'Issue-Number': issueId,
      'Issue-URL': issueUrlForMeta,
      'PR-URL': prUrl,
    },
  });

  ctx.ui.note(`[acommit] Issue #${issueId} → PR #${prNumber}`);
  ctx.ui.note(`[acommit] Saved issue draft: ${savedIssue}`);
  ctx.ui.note(`[acommit] Saved PR draft:    ${savedPr}\n`);
}
