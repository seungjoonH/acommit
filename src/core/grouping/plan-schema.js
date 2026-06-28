/**
 * Commit grouping plan — structured output from rules or LLM.
 * @typedef {{ files: string[], tag: string|null, rationale: string }} PlanGroup
 * @typedef {{ version: number, source: 'rules'|'llm', mode: string, groups: PlanGroup[], draft?: PlanGroup[] }} CommitPlan
 */

export const PLAN_VERSION = 1;

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty plan response');

  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }

  throw new Error('plan response is not valid JSON');
}

export function normalizePlanGroup(group, cfg) {
  const allowed = new Set((cfg.tags?.list || []).map((t) => String(t).toLowerCase()));
  const files = [...new Set((group?.files || []).map((f) => String(f).trim()).filter(Boolean))].sort();
  let tag = group?.tag != null ? String(group.tag).toLowerCase().replace(/:.*$/, '').trim() : null;
  if (tag && allowed.size && !allowed.has(tag)) tag = null;
  if (cfg.tags?.enabled === false) tag = null;

  return {
    files,
    tag: tag || null,
    rationale: String(group?.rationale || '').trim(),
  };
}

export function normalizeCommitPlan(parsed, cfg, meta = {}) {
  const groups = (parsed?.groups || [])
    .map((g) => normalizePlanGroup(g, cfg))
    .filter((g) => g.files.length > 0);

  return {
    version: PLAN_VERSION,
    source: meta.source || 'llm',
    mode: meta.mode || cfg.grouping?.mode || 'per-file',
    groups,
    ...(meta.draft ? { draft: meta.draft } : {}),
  };
}

export function parsePlanResponse(text, cfg, meta = {}) {
  const parsed = extractJsonObject(text);
  const plan = normalizeCommitPlan(parsed, cfg, meta);
  if (!plan.groups.length) {
    throw new Error('plan contains no groups');
  }
  return plan;
}

export function planToFileGroups(plan) {
  return plan.groups.map((g) => [...g.files]);
}
