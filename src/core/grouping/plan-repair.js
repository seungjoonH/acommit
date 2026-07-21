/**
 * Deterministic repairs for LLM grouping plans (no re-request).
 * - drop unknown paths
 * - dedupe across groups (first group wins)
 * - assign missing files using heuristic draft overlap
 * - split files whose forced path tags conflict with the planned group tag
 */

import { resolveForcedTag } from '../ignore/match.js';

function draftGroupIndex(file, draft) {
  for (let i = 0; i < draft.groups.length; i += 1) {
    if (draft.groups[i].files.includes(file)) return i;
  }
  return -1;
}

function bestPlanGroupForDraft(draftIdx, draft, planGroups) {
  const draftFiles = new Set(draft.groups[draftIdx]?.files ?? []);
  if (!draftFiles.size) return -1;

  let best = -1;
  let bestOverlap = 0;
  for (let j = 0; j < planGroups.length; j += 1) {
    const overlap = planGroups[j].files.filter((f) => draftFiles.has(f)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = j;
    }
  }
  return bestOverlap > 0 ? best : -1;
}

function splitForcedTagConflicts(groups, cfg, repairs) {
  const tagsForPaths = cfg?.ignore?.tagsForPaths;
  if (!tagsForPaths || !Object.keys(tagsForPaths).length) return groups;

  const out = [];
  for (const group of groups) {
    const tag = group.tag ? String(group.tag).toLowerCase() : null;
    const keep = [];
    const forcedBuckets = new Map();

    for (const file of group.files) {
      const forced = resolveForcedTag(file, tagsForPaths);
      if (!forced || forced === tag) {
        keep.push(file);
        continue;
      }

      if (!forcedBuckets.has(forced)) forcedBuckets.set(forced, []);
      forcedBuckets.get(forced).push(file);
    }

    if (keep.length) {
      out.push({ ...group, files: keep.sort() });
    }

    for (const [forcedTag, files] of forcedBuckets.entries()) {
      out.push({
        ...group,
        files: files.sort(),
        tag: forcedTag,
        rationale: group.rationale
          ? `${group.rationale}; forced by path tag rules`
          : 'forced by path tag rules',
      });
      repairs.push(
        `split ${files.length} file(s) to forced tag "${forcedTag}" from plan tag "${group.tag ?? 'null'}"`,
      );
    }
  }

  return out;
}

/**
 * @param {import('./plan-schema.js').CommitPlan} plan
 * @param {string[]} allFiles
 * @param {import('./plan-schema.js').CommitPlan} draftPlan
 * @param {object} [cfg]
 * @returns {{ plan: import('./plan-schema.js').CommitPlan, repairs: string[] }}
 */
export function repairCommitPlan(plan, allFiles, draftPlan, cfg = {}) {
  const expected = new Set(allFiles);
  const repairs = [];

  let groups = (plan.groups || []).map((g) => ({
    ...g,
    files: [...new Set((g.files || []).map(String))].filter((f) => {
      if (!expected.has(f)) {
        repairs.push(`removed unknown path from plan: ${f}`);
        return false;
      }
      return true;
    }),
  })).filter((g) => g.files.length > 0);

  groups = splitForcedTagConflicts(groups, cfg, repairs);

  const seen = new Set();
  for (const group of groups) {
    group.files = group.files.filter((f) => {
      if (seen.has(f)) {
        repairs.push(`removed duplicate from plan: ${f}`);
        return false;
      }
      seen.add(f);
      return true;
    });
  }

  const missing = allFiles.filter((f) => !seen.has(f)).sort();
  for (const file of missing) {
    const dgi = draftGroupIndex(file, draftPlan);
    const pgi = dgi >= 0 ? bestPlanGroupForDraft(dgi, draftPlan, groups) : -1;

    if (pgi >= 0) {
      groups[pgi].files.push(file);
      groups[pgi].files.sort();
      repairs.push(`assigned missing file to group ${pgi + 1} (draft overlap): ${file}`);
    } else {
      groups.push({
        files: [file],
        tag: null,
        rationale: '',
      });
      repairs.push(`assigned missing file to new singleton group: ${file}`);
    }
    seen.add(file);
  }

  for (const group of groups) {
    group.files = [...new Set(group.files)].sort();
  }

  groups.sort((a, b) => a.files[0]?.localeCompare(b.files[0] ?? '') ?? 0);

  return {
    plan: {
      ...plan,
      groups,
      repairs: repairs.length ? repairs : undefined,
    },
    repairs,
  };
}
