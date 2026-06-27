/** Add tags from path→tag mappings into tags.list (no removals). */
export function ensureMappedTagsInList(cfg, tagsForPaths) {
  const mapped = [...new Set(
    Object.values(tagsForPaths ?? {})
      .map((t) => String(t).trim())
      .filter(Boolean),
  )];
  const list = cfg.tags?.list ?? [];
  const missing = mapped.filter((t) => !list.includes(t));
  if (missing.length === 0) return cfg;
  return {
    ...cfg,
    tags: { ...cfg.tags, list: [...list, ...missing] },
  };
}
