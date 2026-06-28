import { resolveForcedTag } from '../ignore/match.js';

/**
 * Path-similarity clustering for rules-based grouping modes.
 * For `by-similarity`, output is a heuristic draft for the LLM plan step — not the final partition.
 */

/** CHANGELOG.en.md and CHANGELOG.ko.md → CHANGELOG.md */
export function localeNeutralBasename(filePath) {
  const name = filePath.split('/').pop() ?? filePath;
  return name.replace(/\.(en|ko)(?=\.[^.]+$)/i, '');
}

function parentDir(filePath) {
  const i = filePath.lastIndexOf('/');
  return i === -1 ? '' : filePath.slice(0, i);
}

export function isMarkdownPath(filePath) {
  return /\.md$/i.test(String(filePath || '').split('/').pop() ?? '');
}

/** Shared path prefix depth ratio (directory structure). */
export function pathSegmentSimilarity(a, b) {
  if (a === b) return 1;
  const ap = a.split('/');
  const bp = b.split('/');
  const shared = ap.filter((s, i) => s === bp[i]).length;
  return shared / Math.max(ap.length, bp.length);
}

/**
 * Pairwise similarity for by-similarity grouping.
 *
 * similarity(a,b) = max(
 *   pathSegmentSimilarity,
 *   localePair → 1.0 when neutral basename matches (.en/.ko),
 *   markdownCoLocated → grouping.markdownSameDirSimilarity when same dir, both .md, different basename
 * )
 *
 * Merge clusters when similarity >= grouping.threshold.
 *
 * Examples (threshold=0.6, markdownSameDirSimilarity=0.55):
 * - CHANGELOG.en + CHANGELOG.ko → 1.0 → merge (locale; always)
 * - README + CHANGELOG → 0.55 → split
 * - README + CHANGELOG → merge if threshold≤0.55 or markdownSameDirSimilarity=1
 */
export function computeFileSimilarity(a, b, cfg = {}) {
  if (a === b) return 1;

  const scores = [pathSegmentSimilarity(a, b)];

  const sameDir = parentDir(a) === parentDir(b);
  if (sameDir && localeNeutralBasename(a) === localeNeutralBasename(b)) {
    scores.push(1);
  } else if (sameDir && isMarkdownPath(a) && isMarkdownPath(b)) {
    const md = cfg.grouping?.markdownSameDirSimilarity;
    if (Number.isFinite(md) && md > 0) scores.push(md);
  }

  return Math.max(...scores);
}

function getDirKey(filePath, depth) {
  const parts = filePath.split('/');
  if (parts.length === 1) return '';
  return parts.slice(0, depth).join('/');
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
            ...groups[i].flatMap((a) => groups[j].map((b) => computeFileSimilarity(a, b, cfg))),
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
    return splitSmallBuckets(groups, minFiles);
  }

  return sorted.map((p) => [p]);
}
