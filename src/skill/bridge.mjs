#!/usr/bin/env node
// Thin CLI bridge between the acommit Skill (SKILL.md) and the reusable
// src/core/* engine. Every subcommand is args-in / one JSON object on
// stdout — no LLM calls, no interactive prompts, no policy logic of its
// own. It exists so a Skill-driven Agent can reuse exactly the same
// grouping/prompt-building/validation code the CLI uses, substituting
// itself for the LLM call the CLI would otherwise make.
//
// Handler functions are pure (return data or throw) so tests can call
// them directly without spawning a subprocess; only `main()` does I/O
// (stdout + exit code) when this file is run as a script.
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadConfig, saveConfig } from '../core/config/load.js';
import { DiffCollector } from '../core/diff/collector.js';
import {
  isSensitiveEnvPath,
  isIgnoredByGitignore,
  missingEnvGitignorePatterns,
} from '../core/safety/env-guard.js';
import {
  buildRulesCommitPlan,
  usesLlmPlan,
} from '../core/grouping/plan.js';
import { buildPlanPrompt } from '../core/grouping/plan-prompt.js';
import { parsePlanResponse } from '../core/grouping/plan-schema.js';
import { repairCommitPlan } from '../core/grouping/plan-repair.js';
import {
  validateCommitGroupPlan,
  formatPlanValidationErrors,
} from '../core/grouping/plan-validate.js';
import {
  validateCommitPlan,
  formatValidationErrors,
} from '../core/grouping/validate.js';
import { buildPromptFromDiff } from '../core/prompt/build.js';
import { validateGeneratedCommit } from '../core/message/validate.js';
import { inferRulesFromHistory, parseHistoryLog } from '../core/history/infer-rules.js';
import { parseCommitText } from '../utils/parseCommitText.js';
import { createGit } from '../adapters/git.js';
import { effectiveLocalSettings, writeLocalSettings, migrateLegacySettings } from '../core/settings/local.js';
import { PROVIDERS } from '../core/llm/providers.js';
import { listProviderModels, providerSecret, resolveProviderEnvironment } from '../core/llm/provider-env.js';
import { saveSession } from '../utils/result.js';
import { nowStamp } from '../utils/date.js';
import createLLMClient from '../core/llm/index.js';

async function loadExtraPrompts(cwd, cfg) {
  const oneTimePath = path.join(cwd, '.acommit', 'last_prompt.json');
  try {
    const raw = await fs.readFile(oneTimePath, 'utf8');
    const j = JSON.parse(raw);
    if (j && j.text) return [{ text: String(j.text), source: 'one-time' }];
  } catch {
    // no one-time prompt
  }
  if (Array.isArray(cfg.prompts) && cfg.prompts.length) {
    return cfg.prompts.map((p) => ({ text: p.text || String(p), source: 'persistent' }));
  }
  return [];
}

async function detectEnvGuard(cwd, files) {
  const sensitive = [...new Set(files.filter(isSensitiveEnvPath))].sort();
  if (!sensitive.length) return { sensitiveFiles: [], unprotected: [], missingPatterns: [] };

  let content = '';
  try {
    content = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8');
  } catch {
    // no .gitignore yet
  }
  const unprotected = sensitive.filter((f) => !isIgnoredByGitignore(f, content));
  const missingPatterns = unprotected.length ? missingEnvGitignorePatterns(content) : [];
  return { sensitiveFiles: sensitive, unprotected, missingPatterns };
}

function diffTextForGroup(diffByFile, files) {
  return files.map((fp) => diffByFile.get(fp) ?? '').join('');
}

function buildGeneratePlans(cfg, plan, diffByFile, extraPrompts) {
  return plan.groups.map((planGroup) => {
    const groupDiff = diffTextForGroup(diffByFile, planGroup.files);
    const built = buildPromptFromDiff(cfg, groupDiff, extraPrompts, {
      perGroup: true,
      groupFiles: planGroup.files,
      planGroup,
    });
    return { planGroup, files: planGroup.files, ...built };
  });
}

// Throws on validation failure — callers decide how to surface it.
function validateAndBuild(cfg, plan, files, diffByFile, extraPrompts) {
  const planValidation = validateCommitGroupPlan(plan, files, cfg);
  if (!planValidation.ok) {
    throw new Error(`Invalid commit plan:\n${formatPlanValidationErrors(planValidation.issues)}`);
  }
  const generatePlans = buildGeneratePlans(cfg, plan, diffByFile, extraPrompts);
  const outputValidation = validateCommitPlan(
    plan.groups.map((g) => g.files),
    cfg,
    { promptTokens: generatePlans.map((p) => p.approxTokens) },
  );
  if (!outputValidation.ok) {
    throw new Error(`Cannot generate commits safely:\n${formatValidationErrors(outputValidation.issues)}`);
  }
  return generatePlans;
}

export async function collect({ cwd }) {
  const cfg = await loadConfig(cwd);
  const dc = new DiffCollector({
    cwd,
    skip: cfg.diff?.skip ?? [],
    omitContent: cfg.diff?.omitContent ?? [],
    untrackedSizeLimit: cfg.diff?.untrackedSizeLimit,
  });
  const files = await dc.listFiles();
  if (!files.length) return { mode: 'no-changes', cfg, files: [] };

  const envGuard = await detectEnvGuard(cwd, files);
  const extraPrompts = await loadExtraPrompts(cwd, cfg);

  const diffByFile = new Map();
  for (const fp of files) diffByFile.set(fp, await dc.render(fp));

  if (usesLlmPlan(cfg)) {
    const draftPlan = buildRulesCommitPlan(files, cfg);
    const groupingPrompt = buildPlanPrompt({ files, cfg, diffByFile, draftPlan, extraPrompts });
    return { mode: 'needs-grouping', cfg, files, envGuard, draftPlan, groupingPrompt };
  }

  const plan = buildRulesCommitPlan(files, cfg);
  const generatePlans = validateAndBuild(cfg, plan, files, diffByFile, extraPrompts);
  return { mode: 'ready', cfg, files, envGuard, plan, generatePlans };
}

export async function finalizePlan({ cwd, agentText }) {
  if (!agentText) throw new Error('agentText is required');
  const cfg = await loadConfig(cwd);
  const dc = new DiffCollector({
    cwd,
    skip: cfg.diff?.skip ?? [],
    omitContent: cfg.diff?.omitContent ?? [],
    untrackedSizeLimit: cfg.diff?.untrackedSizeLimit,
  });
  const files = await dc.listFiles();
  const extraPrompts = await loadExtraPrompts(cwd, cfg);
  const diffByFile = new Map();
  for (const fp of files) diffByFile.set(fp, await dc.render(fp));

  const draft = buildRulesCommitPlan(files, cfg);
  let plan;
  try {
    const parsed = parsePlanResponse(agentText, cfg, {
      source: 'llm',
      mode: 'by-similarity',
      draft: draft.groups,
    });
    const repaired = repairCommitPlan(parsed, files, draft, cfg);
    plan = repaired.plan;
    if (repaired.repairs.length) plan.draft = draft.groups;
  } catch (err) {
    throw new Error(`Could not parse grouping plan: ${err.message}`);
  }

  const generatePlans = validateAndBuild(cfg, plan, files, diffByFile, extraPrompts);
  return { mode: 'ready', cfg, files, plan, generatePlans };
}

export async function settingsGet({ cwd }) {
  const cfg = await loadConfig(cwd);
  const result = await effectiveLocalSettings(cwd, cfg);
  return { ...result, skill: result.effective.execution };
}

export async function settingsSet({ cwd, key, value }) {
  if (!key) throw new Error('key is required');
  const validators = {
    backend: (v) => ['agent', 'api'].includes(v),
    autoExecuteGit: (v) => typeof v === 'boolean',
    autoPush: (v) => typeof v === 'boolean',
    envGuardMode: (v) => ['auto-add', 'ask', 'block'].includes(v),
    confirmPlanBeforeGenerate: (v) => typeof v === 'boolean',
  };
  if (!validators[key]) throw new Error(`Unknown skill setting: ${key}`);
  if (!validators[key](value)) throw new Error(`Invalid value for skill setting: ${key}`);
  const patch = key === 'backend'
    ? { commit: { backend: value } }
    : { execution: { [key]: value } };
  const settings = await writeLocalSettings(cwd, patch);
  return { settings, skill: settings.execution };
}

export async function apiSetupStatus({ cwd }) {
  const cfg = await loadConfig(cwd);
  const { effective, migration } = await effectiveLocalSettings(cwd, cfg);
  const provider = effective.api.provider;
  const model = effective.api.model;
  const environment = await resolveProviderEnvironment(cwd, provider);
  let envSafe = true;
  if (environment.source === 'project') {
    let gitignore = '';
    try { gitignore = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8'); } catch { /* missing */ }
    envSafe = isIgnoredByGitignore('.env', gitignore);
  }
  const missing = [];
  if (!provider) missing.push('provider');
  if (!model) missing.push('model');
  if (!environment.configured) missing.push(...environment.missing);
  const invalid = provider && !PROVIDERS[provider];
  const state = invalid ? 'invalid' : missing.length === 0 ? 'configured' : !provider && !model ? 'empty' : 'partial';
  return {
    state,
    backend: effective.commit.backend,
    provider,
    model,
    key: { configured: environment.configured, source: environment.source, variable: environment.variable, safe: envSafe },
    missing: [...new Set(missing)],
    migration,
  };
}

export async function apiSetupSave({ cwd, provider, model }) {
  if (!PROVIDERS[provider]) throw new Error(`Unknown provider: ${provider}`);
  if (!String(model || '').trim()) throw new Error('model is required');
  const environment = await resolveProviderEnvironment(cwd, provider);
  if (!environment.configured) throw new Error(`${environment.variable} is not configured`);
  if (environment.source === 'project') {
    let gitignore = '';
    try { gitignore = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8'); } catch { /* missing */ }
    if (!isIgnoredByGitignore('.env', gitignore)) throw new Error('Project .env is not protected by .gitignore');
  }
  const settings = await writeLocalSettings(cwd, { api: { provider, model: String(model).trim() }, commit: { backend: 'api' } });
  return { saved: true, settings };
}

export async function modelsList({ cwd, provider }) {
  return { provider, models: await listProviderModels(cwd, provider) };
}

export async function apiConnectionTest({ cwd, provider, model }) {
  if (!PROVIDERS[provider] || !model) throw new Error('valid provider and model are required');
  const environment = await resolveProviderEnvironment(cwd, provider);
  if (!environment.configured) throw new Error(`${environment.variable} is not configured`);
  const client = await createLLMClient(provider, { model, apiKey: await providerSecret(cwd, provider) });
  const out = await client?.gen('Reply with exactly OK.', { system: 'This is an acommit connection test.', maxTokens: 8 });
  if (!String(out?.text || '').trim()) throw new Error(out?.raw?.error || 'Connection test returned no text');
  return { verified: true, provider, model };
}

export async function migrateSettings({ cwd }) {
  const cfg = await loadConfig(cwd);
  return migrateLegacySettings(cwd, cfg);
}

export async function saveAgentSession({ cwd, plan, commits, agent }) {
  if (!plan || !Array.isArray(commits) || !commits.length) throw new Error('plan and non-empty commits are required');
  const cfg = await loadConfig(cwd);
  const session = {
    schemaVersion: 2,
    id: nowStamp(),
    timestamp: new Date().toISOString(),
    backend: 'agent',
    provider: null,
    model: null,
    agent: agent || { host: 'unknown' },
    groupingMode: cfg.grouping?.mode ?? 'per-file',
    planSource: plan.source || 'agent',
    commitPlan: plan,
    commits: commits.map((commit) => ({
      ...commit,
      validation: commit.validation || { ok: true, issues: [] },
      execution: commit.execution || { committed: false, pushed: false },
    })),
  };
  return { saved: await saveSession(cwd, session), session };
}

export async function formatCommit({ cwd, text, files }) {
  if (!text || !files) throw new Error('text and files are required');
  const cfg = await loadConfig(cwd);
  const parsed = parseCommitText(text, files, cfg);
  const validation = validateGeneratedCommit(parsed, cfg);
  if (!validation.ok) {
    const err = new Error(`Generated commit message violates rules: ${validation.issues.map((i) => i.message).join(' ')}`);
    err.issues = validation.issues;
    throw err;
  }
  const commitMessage = parsed.body.length
    ? [parsed.subject, '', ...parsed.body.map((b) => `- ${b}`)].join('\n')
    : parsed.subject;
  return { ...parsed, commitMessage };
}

export async function execute({ cwd, files, message, push }) {
  if (!Array.isArray(files) || !files.length || !message) throw new Error('non-empty files and message are required');
  const git = createGit(cwd);
  await git.add(files);
  await git.commitOnly(message, files);
  let pushed = false;
  if (push) {
    await git.push();
    pushed = true;
  }
  return { committed: true, files, pushed };
}

export async function analyzeHistory({ cwd, maxCount = 200, since }) {
  const limit = Math.max(10, Math.min(1000, Number(maxCount) || 200));
  const git = createGit(cwd);
  const raw = await git.history({ maxCount: limit, since });
  const commits = parseHistoryLog(raw);
  return { maxCount: limit, since: since || null, ...inferRulesFromHistory(commits) };
}

export async function applyInferredRules({ cwd, rules }) {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('rules must be a JSON object');
  }
  const allowed = new Set(['message', 'tags', 'grouping', 'conventional', 'ignore', 'diff']);
  const unknown = Object.keys(rules).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unsupported inferred rule sections: ${unknown.join(', ')}`);

  const file = path.join(cwd, '.acommit', 'rules.yml');
  const backup = `${file}.bak`;
  let backedUp = false;
  try {
    await fs.copyFile(file, backup);
    backedUp = true;
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  const cfg = await saveConfig(cwd, rules);
  return { applied: true, backedUp, backup: backedUp ? backup : null, rules: cfg };
}

// --- CLI dispatch (only runs when this file is executed directly) ---

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function camelize(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function main() {
  const [, , subcommand, ...rest] = process.argv;
  const rawArgs = parseArgs(rest);
  const args = { cwd: process.cwd() };
  for (const [key, value] of Object.entries(rawArgs)) args[camelize(key)] = value;

  const handlers = {
    collect,
    'finalize-plan': finalizePlan,
    'settings-get': settingsGet,
    'settings-set': settingsSet,
    'settings-migrate': migrateSettings,
    'api-setup-status': apiSetupStatus,
    'api-setup-save': apiSetupSave,
    'models-list': modelsList,
    'api-test': apiConnectionTest,
    'save-agent-session': saveAgentSession,
    'format-commit': formatCommit,
    execute,
    'analyze-history': analyzeHistory,
    'apply-inferred-rules': applyInferredRules,
  };

  const handler = handlers[subcommand];
  if (!handler) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: `Unknown subcommand "${subcommand}". Expected one of: ${Object.keys(handlers).join(', ')}`,
    }) + '\n');
    process.exitCode = 1;
    return;
  }

  // CLI args arrive as JSON-encoded strings for structured fields.
  for (const jsonField of ['value', 'files', 'rules', 'plan', 'commits', 'agent']) {
    if (typeof args[jsonField] === 'string') {
      try {
        args[jsonField] = JSON.parse(args[jsonField]);
      } catch {
        // leave as raw string
      }
    }
  }
  if (typeof args.push === 'string') args.push = args.push === 'true';

  try {
    const result = await handler(args);
    process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err?.message || String(err) }) + '\n');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
