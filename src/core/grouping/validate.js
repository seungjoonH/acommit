import { CHARS_PER_TOKEN } from '../constants.js';

const PER_GROUP_OUTPUT_CAP = 800;

/** Worst case: one `git add <path>` line per file (invalid but used for safety). */
export function estimateWorstCaseOutputChars(files) {
  const lines = files.reduce((n, f) => n + 8 + f.length + 1, 0);
  return lines + 120;
}

export function estimateExpectedOutputChars(files, cfg) {
  const wrap = cfg.message?.wrap ?? 72;
  const pathsLen = files.reduce((n, f) => n + f.length + 1, 0);
  const multiExtra = cfg.message?.lines === 'multi' ? 400 : 0;
  return wrap + 30 + 8 + pathsLen + 20 + multiExtra;
}

export function perGroupOutputTokenCap(cfg) {
  const configured = cfg.llm?.maxOutputTokens ?? 4000;
  return Math.min(configured, PER_GROUP_OUTPUT_CAP);
}

/**
 * Pre-flight check — reject before any LLM call.
 * @param {string[][]} groups
 * @param {object} cfg normalized rules config
 * @param {{ promptTokens?: number[] }} meta optional per-group prompt token estimates
 */
export function validateCommitPlan(groups, cfg, meta = {}) {
  const issues = [];
  const maxGroupSize = cfg.grouping?.maxGroupSize ?? 10;
  const outputCap = perGroupOutputTokenCap(cfg);
  const maxOutputChars = Math.floor(outputCap * CHARS_PER_TOKEN);
  const maxPromptTokens = cfg.llm?.maxPromptTokens ?? 200_000;
  const promptBudget = Math.floor(maxPromptTokens * 0.9);
  const { promptTokens = [] } = meta;

  if (!groups.length) {
    issues.push({
      code: 'NO_GROUPS',
      message: 'No commit groups to process.',
    });
    return { ok: false, issues };
  }

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const label = `Group ${i + 1}/${groups.length} (${group.length} file${group.length === 1 ? '' : 's'})`;

    if (group.length > maxGroupSize) {
      issues.push({
        code: 'GROUP_TOO_LARGE',
        group: i + 1,
        fileCount: group.length,
        message: `${label} exceeds grouping.maxGroupSize (${maxGroupSize}).`,
        hint: 'Use per-file grouping, lower maxGroupSize, or split changes manually.',
      });
    }

    const expected = estimateExpectedOutputChars(group, cfg);
    const worst = estimateWorstCaseOutputChars(group);
    if (expected > maxOutputChars || worst > maxOutputChars) {
      issues.push({
        code: 'OUTPUT_BUDGET',
        group: i + 1,
        fileCount: group.length,
        message: `${label} is too large for llm output (~${outputCap} tok per commit).`,
        hint: 'Set grouping.mode to per-file, reduce files per commit, or raise llm.maxOutputTokens.',
      });
    }

    const pt = promptTokens[i];
    if (Number.isFinite(pt) && pt > promptBudget) {
      issues.push({
        code: 'PROMPT_BUDGET',
        group: i + 1,
        fileCount: group.length,
        message: `${label} diff prompt is ~${pt} tokens (limit ~${promptBudget}).`,
        hint: 'Commit in smaller batches, add paths to diff.omitContent or diff.skip, or lower diff.untrackedSizeLimit.',
      });
    }
  }

  const totalFiles = groups.reduce((n, g) => n + g.length, 0);
  if (groups.length === 1 && totalFiles > 1 && worstCaseExceeds(groups[0], maxOutputChars)) {
    issues.push({
      code: 'MONOLITHIC_OUTPUT',
      group: 1,
      fileCount: totalFiles,
      message: `All ${totalFiles} files are in a single commit group — output would likely be truncated.`,
      hint: 'Use by-similarity or per-file grouping, or stage fewer files at once.',
    });
  }

  return { ok: issues.length === 0, issues };
}

function worstCaseExceeds(files, maxChars) {
  return estimateWorstCaseOutputChars(files) > maxChars;
}

export function formatValidationErrors(issues) {
  return issues
    .map((issue, idx) => {
      const parts = [`${idx + 1}. ${issue.message}`];
      if (issue.hint) parts.push(`   → ${issue.hint}`);
      return parts.join('\n');
    })
    .join('\n');
}
