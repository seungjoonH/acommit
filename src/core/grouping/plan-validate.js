import { resolveForcedTag } from '../ignore/match.js';

function prefixForFile(file, prefixes) {
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  return sorted.find((p) => file === p || file.startsWith(`${p}/`)) || null;
}

/**
 * Validate a commit grouping plan (no LLM retry — fail fast).
 * @param {import('./plan-schema.js').CommitPlan} plan
 * @param {string[]} allFiles
 * @param {object} cfg
 * @param {object} [caseMeta]
 */
export function validateCommitGroupPlan(plan, allFiles, cfg, caseMeta = {}) {
  const issues = [];
  const expected = new Set(allFiles);
  const seen = new Map();
  const gMeta = caseMeta?.grouping || caseMeta?.expect?.grouping || {};
  const isolated = gMeta.isolatedPrefixes || [];

  if (!plan?.groups?.length) {
    return {
      ok: false,
      issues: [{ code: 'NO_GROUPS', message: 'Plan has no groups.', hint: '' }],
    };
  }

  for (let i = 0; i < plan.groups.length; i += 1) {
    const group = plan.groups[i];
    const label = `Group ${i + 1} (${group.files.length} file${group.files.length === 1 ? '' : 's'})`;

    if (isolated.length >= 2 && group.files.length > 1) {
      const prefixes = new Set(group.files.map((f) => prefixForFile(f, isolated)).filter(Boolean));
      if (prefixes.size > 1) {
        issues.push({
          code: 'ISOLATED_PREFIX_MIX',
          message: `${label} mixes isolated prefixes: ${group.files.join(', ')}`,
          hint: `Keep ${isolated.join(', ')} in separate commits.`,
        });
      }
    }

    for (const file of group.files) {
      if (!expected.has(file)) {
        issues.push({
          code: 'UNKNOWN_FILE',
          message: `${label} references unknown file: ${file}`,
          hint: 'Plan must only include files from the current diff.',
        });
      }
      if (seen.has(file)) {
        issues.push({
          code: 'DUPLICATE_FILE',
          message: `File appears in multiple groups: ${file}`,
          hint: 'Each file must belong to exactly one group.',
        });
      }
      seen.set(file, i + 1);
    }

    if (group.tag && cfg.tags?.enabled !== false) {
      const allowed = new Set((cfg.tags?.list || []).map((t) => t.toLowerCase()));
      if (!allowed.has(String(group.tag).toLowerCase())) {
        issues.push({
          code: 'INVALID_TAG',
          message: `${label} uses disallowed tag "${group.tag}"`,
          hint: `Allowed: ${[...allowed].join(', ')}`,
        });
      }
    }

    for (const file of group.files) {
      const forced = resolveForcedTag(file, cfg.ignore?.tagsForPaths);
      if (forced && group.tag && forced !== group.tag) {
        issues.push({
          code: 'TAG_PATH_MISMATCH',
          message: `${label}: plan tag "${group.tag}" conflicts with path rule "${forced}" for ${file}`,
          hint: 'Align plan tag with tagsForPaths or fix the plan.',
        });
      }
    }
  }

  for (const file of allFiles) {
    if (!seen.has(file)) {
      issues.push({
        code: 'MISSING_FILE',
        message: `File not assigned to any group: ${file}`,
        hint: 'Every changed file must appear in exactly one group.',
      });
    }
  }

  const expectedGroups = gMeta.expectedGroups;
  if (Array.isArray(expectedGroups) && expectedGroups.length) {
    const norm = (groups) => groups.map((g) => [...g].sort().join('|')).sort();
    const actual = norm(plan.groups.map((g) => g.files));
    const want = norm(expectedGroups);
    if (JSON.stringify(actual) !== JSON.stringify(want)) {
      issues.push({
        code: 'EXPECTED_PARTITION',
        message: `Partition mismatch (expected ${want.length} groups, got ${actual.length}).`,
        hint: `Expected: ${JSON.stringify(expectedGroups)}`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function formatPlanValidationErrors(issues) {
  return issues
    .map((issue, idx) => {
      const parts = [`${idx + 1}. ${issue.message}`];
      if (issue.hint) parts.push(`   → ${issue.hint}`);
      return parts.join('\n');
    })
    .join('\n');
}
