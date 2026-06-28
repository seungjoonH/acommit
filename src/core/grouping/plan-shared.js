/** Shared helpers for plan + generate prompts. */

export function filteredPathTagEntries(cfg) {
  const entries = Object.entries(cfg.ignore?.tagsForPaths ?? {});
  if (cfg.tags?.enabled === false) return entries;
  const allowed = new Set((cfg.tags?.list || []).map((t) => String(t).toLowerCase()));
  if (!allowed.size) return entries;
  return entries.filter(([, tag]) => allowed.has(String(tag).toLowerCase()));
}

export function usesLlmPlan(cfg) {
  return (cfg.grouping?.mode ?? 'per-file') === 'by-similarity';
}
