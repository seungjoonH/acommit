import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export const LOCAL_SETTINGS_FILE = '.acommit/settings.local.yml';

export const LOCAL_DEFAULTS = Object.freeze({
  commit: { backend: null },
  execution: {
    autoExecuteGit: null,
    autoPush: null,
    envGuardMode: null,
    confirmPlanBeforeGenerate: null,
  },
  api: { provider: null, model: null },
});

function deepMerge(target, patch) {
  const out = { ...target };
  for (const [key, value] of Object.entries(patch || {})) {
    out[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(target?.[key] || {}, value)
      : value;
  }
  return out;
}

export function normalizeLocalSettings(value = {}) {
  const out = deepMerge(LOCAL_DEFAULTS, value);
  if (!['agent', 'api'].includes(out.commit.backend)) out.commit.backend = null;
  if (!['gemini', 'openai', 'openrouter'].includes(out.api.provider)) out.api.provider = null;
  if (typeof out.api.model !== 'string' || !out.api.model.trim()) out.api.model = null;
  for (const key of ['autoExecuteGit', 'autoPush', 'confirmPlanBeforeGenerate']) {
    if (typeof out.execution[key] !== 'boolean') out.execution[key] = null;
  }
  if (!['auto-add', 'ask', 'block'].includes(out.execution.envGuardMode)) {
    out.execution.envGuardMode = null;
  }
  return out;
}

export async function readLocalSettings(cwd = process.cwd()) {
  try {
    const raw = YAML.parse(await fs.readFile(path.join(cwd, LOCAL_SETTINGS_FILE), 'utf8')) || {};
    return normalizeLocalSettings(raw);
  } catch {
    return normalizeLocalSettings();
  }
}

export async function writeLocalSettings(cwd, patch) {
  const file = path.join(cwd, LOCAL_SETTINGS_FILE);
  let raw = {};
  try { raw = YAML.parse(await fs.readFile(file, 'utf8')) || {}; } catch { /* new file */ }
  const merged = deepMerge(raw, patch);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, YAML.stringify(merged), 'utf8');
  return normalizeLocalSettings(merged);
}

export async function effectiveLocalSettings(cwd, rules = {}) {
  const local = await readLocalSettings(cwd);
  let rawRules = {};
  try { rawRules = YAML.parse(await fs.readFile(path.join(cwd, '.acommit', 'rules.yml'), 'utf8')) || {}; } catch { /* no legacy file */ }
  const legacy = {
    execution: {
      autoExecuteGit: rawRules.skill?.autoExecuteGit ?? null,
      autoPush: rawRules.skill?.autoPush ?? null,
      envGuardMode: rawRules.skill?.envGuardMode ?? null,
      confirmPlanBeforeGenerate: rawRules.skill?.confirmPlanBeforeGenerate ?? null,
    },
    api: {
      provider: rawRules.llm?.provider ?? null,
      model: rawRules.llm?.model ?? null,
    },
  };
  const effective = normalizeLocalSettings({
    commit: local.commit,
    execution: Object.fromEntries(Object.entries(local.execution).map(([k, v]) => [k, v ?? legacy.execution[k]])),
    api: {
      provider: local.api.provider ?? legacy.api.provider,
      model: local.api.model ?? legacy.api.model,
    },
  });
  const migration = {
    available: Boolean(rawRules.skill || rawRules.llm) && JSON.stringify(local) === JSON.stringify(normalizeLocalSettings()),
    legacy,
  };
  return { local, effective, migration };
}

export async function migrateLegacySettings(cwd, rules = {}) {
  const { effective, migration } = await effectiveLocalSettings(cwd, rules);
  if (!migration.available) return { migrated: false, settings: effective };
  return { migrated: true, settings: await writeLocalSettings(cwd, effective) };
}
