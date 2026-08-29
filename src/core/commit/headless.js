import { collect, finalizePlan, formatCommit } from '../../skill/bridge.mjs';
import { loadConfig } from '../config/load.js';
import { effectiveLocalSettings } from '../settings/local.js';
import createLLMClient from '../llm/index.js';
import { perGroupOutputTokenCap } from '../grouping/validate.js';
import { saveSession } from '../../utils/result.js';
import { nowStamp } from '../../utils/date.js';
import { providerSecret } from '../llm/provider-env.js';

async function generate(client, prompt, maxTokens) {
  const out = await client.gen(prompt.user, { system: prompt.system, maxTokens });
  const text = String(out?.text || '').trim();
  if (!text) throw new Error(out?.raw?.error || out?.raw || 'API returned an empty response');
  return text;
}

export async function runHeadlessCommit({ cwd = process.cwd() } = {}) {
  const rules = await loadConfig(cwd);
  const { effective } = await effectiveLocalSettings(cwd, rules);
  const { provider, model } = effective.api;
  if (!provider || !model) {
    throw new Error('API setup is incomplete. Configure provider and model before using headless commit.');
  }
  const client = await createLLMClient(provider, { model, apiKey: await providerSecret(cwd, provider) });
  if (!client) throw new Error(`Could not initialize API provider '${provider}'`);

  let prepared = await collect({ cwd });
  if (prepared.mode === 'no-changes') return { mode: 'no-changes', backend: 'api', commits: [] };
  if (prepared.envGuard?.unprotected?.length) {
    const err = new Error(`Sensitive env files are not protected: ${prepared.envGuard.unprotected.join(', ')}`);
    err.code = 'ENV_GUARD';
    throw err;
  }
  const maxTokens = perGroupOutputTokenCap(rules);
  if (prepared.mode === 'needs-grouping') {
    const groupingText = await generate(client, prepared.groupingPrompt, maxTokens);
    prepared = await finalizePlan({ cwd, agentText: groupingText });
  }

  const commits = [];
  for (const prompt of prepared.generatePlans) {
    const raw = await generate(client, prompt, maxTokens);
    const formatted = await formatCommit({ cwd, text: raw, files: prompt.files });
    commits.push({
      ...formatted,
      files: prompt.files,
      planRationale: prompt.planGroup?.rationale || null,
      planTag: prompt.planGroup?.tag || null,
      validation: { ok: true, issues: [] },
      execution: { committed: false, pushed: false },
    });
  }

  const session = {
    schemaVersion: 2,
    id: nowStamp(),
    timestamp: new Date().toISOString(),
    backend: 'api',
    provider,
    model,
    agent: null,
    groupingMode: rules.grouping?.mode ?? 'per-file',
    planSource: prepared.plan?.source || 'rules',
    commitPlan: prepared.plan,
    commits,
  };
  const saved = await saveSession(cwd, session);
  return { mode: 'ready', backend: 'api', provider, model, saved, session };
}
