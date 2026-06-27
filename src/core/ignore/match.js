/** Glob matcher shared by diff collector and web preview. Supports * and **. */

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const reStr = escaped.replace(/\*\*/g, '\x00').replace(/\*/g, '[^/]*').replace(/\x00/g, '.*');
  return new RegExp(`^${reStr}$`);
}

export function matchesGlob(pattern, filePath) {
  if (globToRegex(pattern).test(filePath)) return true;
  if (!pattern.includes('/')) {
    const name = filePath.split('/').pop();
    if (globToRegex(pattern).test(name)) return true;
  }
  return false;
}

export function matchesAnyGlob(patterns, filePath) {
  return (patterns ?? []).some((p) => matchesGlob(p, filePath));
}

/** Longest pattern wins; ties keep first in sorted-by-length order. */
export function resolveForcedTag(filePath, tagsForPaths = {}) {
  const entries = Object.entries(tagsForPaths)
    .filter(([pattern]) => matchesGlob(pattern, filePath))
    .sort((a, b) => b[0].length - a[0].length);
  return entries[0]?.[1] ?? null;
}
