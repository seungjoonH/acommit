import { validateCommitPlan, estimateWorstCaseOutputChars } from '../src/core/grouping/validate.js';
import { CHARS_PER_TOKEN } from '../src/core/constants.js';

const cfg = {
  message: { wrap: 72, lines: 'single' },
  grouping: {},
  llm: { maxOutputTokens: 4000, maxPromptTokens: 200_000 },
};

describe('validateCommitPlan', () => {
  test('accepts small per-file groups', () => {
    const groups = [['a.js'], ['b.js']];
    const result = validateCommitPlan(groups, cfg);
    expect(result.ok).toBe(true);
  });

  test('rejects when many files exceed output token cap', () => {
    const cap = cfg.llm.maxOutputTokens;
    const maxChars = Math.floor(cap * CHARS_PER_TOKEN);
    const files = [];
    let total = 0;
    while (total < maxChars) {
      const f = `src/very/long/path/file-${files.length}.js`;
      files.push(f);
      total = estimateWorstCaseOutputChars(files);
    }
    const result = validateCommitPlan([files], cfg);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'OUTPUT_BUDGET' || i.code === 'MONOLITHIC_OUTPUT')).toBe(true);
  });

  test('rejects when prompt tokens exceed budget', () => {
    const groups = [['a.js']];
    const result = validateCommitPlan(groups, cfg, {
      promptTokens: [cfg.llm.maxPromptTokens],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'PROMPT_BUDGET')).toBe(true);
  });
});
