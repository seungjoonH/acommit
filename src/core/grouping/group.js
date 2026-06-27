import { resolveForcedTag } from '../ignore/match.js';

function chunkBy(arr, maxSize) {
  if (!maxSize || arr.length <= maxSize) return [arr];
  const chunks = [];
  for (let i = 0; i < arr.length; i += maxSize) chunks.push(arr.slice(i, i + maxSize));
  return chunks;
}

function getDirKey(filePath, depth) {
  const parts = filePath.split('/');
  return parts.slice(0, depth).join('/');
}

function pathSimilarity(a, b) {
  if (a === b) return 1;
  const ap = a.split('/');
  const bp = b.split('/');
  const shared = ap.filter((s, i) => s === bp[i]).length;
  return shared / Math.max(ap.length, bp.length);
}

function splitSmallBuckets(groups, minFiles) {
  const out = [];
  for (const g of groups) {
    if (g.length < minFiles) {
      g.forEach((p) => out.push([p]));
    } else {
      out.push(g);
    }
  }
  return out;
}

/** @returns {string[][]} sorted file path groups */
export function groupFilePaths(filePaths, cfg = {}) {
  const sorted = [...new Set(filePaths)].sort();
  if (!sorted.length) return [];

  const g = cfg.grouping ?? {};
  const mode = g.mode ?? 'per-file';
  const minFiles = Number.isFinite(g.minFilesPerGroup) ? g.minFilesPerGroup : 2;
  const depth = Number.isFinite(g.directoryDepth) ? g.directoryDepth : 1;
  const threshold = Number.isFinite(g.threshold) ? g.threshold : 0.6;
  const maxGroup = Number.isFinite(g.maxGroupSize) ? g.maxGroupSize : 10;

  if (mode === 'per-file' || mode === 'none') {
    return sorted.map((p) => [p]);
  }

  if (mode === 'by-directory') {
    const dirMap = new Map();
    for (const p of sorted) {
      const key = getDirKey(p, depth);
      if (!dirMap.has(key)) dirMap.set(key, []);
      dirMap.get(key).push(p);
    }
    const groups = [...dirMap.values()].map((arr) => [...arr].sort());
    return splitSmallBuckets(groups, minFiles);
  }

  if (mode === 'by-tag') {
    const tagMap = new Map();
    const tagsForPaths = cfg.ignore?.tagsForPaths ?? {};
    for (const p of sorted) {
      const tag = resolveForcedTag(p, tagsForPaths) || p;
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push(p);
    }
    const groups = [...tagMap.values()].map((arr) => [...arr].sort());
    return splitSmallBuckets(groups, minFiles);
  }

  if (mode === 'by-similarity') {
    let groups = sorted.map((p) => [p]);
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const maxSim = Math.max(
            ...groups[i].flatMap((a) => groups[j].map((b) => pathSimilarity(a, b))),
          );
          if (maxSim >= threshold) {
            groups[i] = [...groups[i], ...groups[j]].sort();
            groups.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
    const chunked = groups.flatMap((grp) => chunkBy(grp, maxGroup));
    return splitSmallBuckets(chunked, minFiles);
  }

  return sorted.map((p) => [p]);
}
