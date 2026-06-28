import { groupFilePaths } from './group.js';
import { parsePlanResponse } from './plan-schema.js';
import { buildPlanPrompt } from './plan-prompt.js';
import { usesLlmPlan } from './plan-shared.js';
import { repairCommitPlan } from './plan-repair.js';

export { usesLlmPlan };

/**
 * Deterministic plan from rules (per-file, by-directory, by-tag, none).
 * @param {string[]} files
 * @param {object} cfg
 * @returns {import('./plan-schema.js').CommitPlan}
 */
export function buildRulesCommitPlan(files, cfg) {
  const mode = cfg.grouping?.mode ?? 'per-file';
  const fileGroups = groupFilePaths(files, cfg);

  return {
    version: 1,
    source: 'rules',
    mode,
    groups: fileGroups.map((filePaths) => ({
      files: filePaths,
      tag: null,
      rationale: '',
    })),
  };
}

/**
 * Build commit grouping plan.
 * - Structural modes → rules only (no LLM).
 * - by-similarity → LLM plan (1 request) with heuristic draft hint.
 *
 * @param {object} opts
 * @param {string[]} opts.files
 * @param {object} opts.cfg
 * @param {Map<string,string>} [opts.diffByFile]
 * @param {{ gen: Function }} [opts.client]
 * @param {Array<{text:string}>} [opts.extraPrompts]
 */
export async function buildCommitPlan({
  files,
  cfg,
  diffByFile,
  client,
  extraPrompts = [],
}) {
  if (!usesLlmPlan(cfg)) {
    return buildRulesCommitPlan(files, cfg);
  }

  if (!client?.gen) {
    throw new Error('LLM client required for by-similarity grouping plan');
  }

  const draft = buildRulesCommitPlan(files, cfg);
  const prompt = buildPlanPrompt({
    files,
    cfg,
    diffByFile,
    draftPlan: draft,
    extraPrompts,
  });

  const out = await client.gen(prompt.user, {
    system: prompt.system,
    maxTokens: Math.min(cfg.llm?.maxOutputTokens ?? 4000, 4096),
  });

  const text = (out?.text ?? '').trim();
  if (!text) {
    const err = out?.raw?.error || out?.raw?.suggestion || 'empty plan response';
    throw new Error(String(err));
  }

  try {
    const parsed = parsePlanResponse(text, cfg, {
      source: 'llm',
      mode: 'by-similarity',
      draft: draft.groups,
    });
    const { plan, repairs } = repairCommitPlan(parsed, files, draft);
    if (repairs.length) {
      plan.draft = draft.groups;
    }
    return plan;
  } catch (err) {
    throw new Error(`invalid grouping plan: ${err.message}`);
  }
}
