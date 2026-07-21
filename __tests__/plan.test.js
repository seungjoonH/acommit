import {
  buildRulesCommitPlan,
  usesLlmPlan,
} from '../src/core/grouping/plan.js';
import { parsePlanResponse } from '../src/core/grouping/plan-schema.js';
import { repairCommitPlan } from '../src/core/grouping/plan-repair.js';
import {
  validateCommitGroupPlan,
} from '../src/core/grouping/plan-validate.js';
import { parseCommitGroups } from '../experiments/eval/lib/parse.js';

describe('usesLlmPlan', () => {
  test('only by-similarity uses LLM plan', () => {
    expect(usesLlmPlan({ grouping: { mode: 'by-similarity' } })).toBe(true);
    expect(usesLlmPlan({ grouping: { mode: 'per-file' } })).toBe(false);
    expect(usesLlmPlan({ grouping: { mode: 'by-directory' } })).toBe(false);
    expect(usesLlmPlan({ grouping: { mode: 'by-tag' } })).toBe(false);
  });
});

describe('buildRulesCommitPlan', () => {
  test('per-file produces one file per group', () => {
    const plan = buildRulesCommitPlan(['b.js', 'a.js'], { grouping: { mode: 'per-file' } });
    expect(plan.source).toBe('rules');
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups.map((g) => g.files)).toEqual([['a.js'], ['b.js']]);
  });

  test('by-directory keeps all same-dir files in one group', () => {
    const files = Array.from({ length: 12 }, (_, i) => `pkg/a/f${i}.js`);
    const plan = buildRulesCommitPlan(files, {
      grouping: { mode: 'by-directory', minFilesPerGroup: 1 },
    });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].files).toHaveLength(12);
  });
});

describe('parsePlanResponse', () => {
  const cfg = {
    tags: { enabled: true, list: ['docs', 'feat'] },
    grouping: { mode: 'by-similarity' },
  };

  test('parses fenced JSON', () => {
    const text = '```json\n{"version":1,"groups":[{"files":["a.md","b.md"],"tag":"docs","rationale":"locale pair"}]}\n```';
    const plan = parsePlanResponse(text, cfg, { source: 'llm', mode: 'by-similarity' });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].files).toEqual(['a.md', 'b.md']);
    expect(plan.groups[0].tag).toBe('docs');
  });

  test('rejects unknown tag', () => {
    const text = '{"groups":[{"files":["x.js"],"tag":"bogus"}]}';
    const plan = parsePlanResponse(text, cfg);
    expect(plan.groups[0].tag).toBeNull();
  });
});

describe('repairCommitPlan', () => {
  test('assigns missing files using draft group overlap', () => {
    const draft = buildRulesCommitPlan(
      ['src/core/grouping/plan.js', 'src/core/grouping/plan-shared.js', 'src/a.js'],
      { grouping: { mode: 'by-similarity', minFilesPerGroup: 1 } },
    );
    const plan = {
      version: 1,
      source: 'llm',
      mode: 'by-similarity',
      groups: [
        {
          files: ['src/core/grouping/plan.js', 'src/a.js'],
          tag: 'feat',
          rationale: 'grouping work',
        },
      ],
    };
    const { plan: repaired, repairs } = repairCommitPlan(
      plan,
      ['src/core/grouping/plan.js', 'src/core/grouping/plan-shared.js', 'src/a.js'],
      draft,
    );
    expect(repaired.groups).toHaveLength(1);
    expect(repaired.groups[0].files).toEqual([
      'src/a.js',
      'src/core/grouping/plan-shared.js',
      'src/core/grouping/plan.js',
    ]);
    expect(repairs.some((r) => r.includes('plan-shared.js'))).toBe(true);
  });

  test('removes unknown and duplicate paths', () => {
    const draft = buildRulesCommitPlan(['a.js', 'b.js'], { grouping: { mode: 'per-file' } });
    const plan = {
      groups: [
        { files: ['a.js', 'ghost.js'], tag: null, rationale: '' },
        { files: ['a.js', 'b.js'], tag: null, rationale: '' },
      ],
    };
    const { plan: repaired } = repairCommitPlan(plan, ['a.js', 'b.js'], draft);
    const flat = repaired.groups.flatMap((g) => g.files).sort();
    expect(flat).toEqual(['a.js', 'b.js']);
  });

  test('splits files with forced path tags away from conflicting plan tags', () => {
    const cfg = {
      tags: { enabled: true, list: ['docs', 'feat'] },
      grouping: { mode: 'by-similarity' },
      ignore: { tagsForPaths: { '*.md': 'docs' } },
    };
    const files = ['README.md', 'skills/mykit/SKILL.md', 'src/feature.js'];
    const draft = buildRulesCommitPlan(files, cfg);
    const plan = {
      version: 1,
      source: 'llm',
      mode: 'by-similarity',
      groups: [
        {
          files,
          tag: 'feat',
          rationale: 'add mykit feature',
        },
      ],
    };

    const { plan: repaired, repairs } = repairCommitPlan(plan, files, draft, cfg);
    expect(repairs.some((r) => r.includes('forced tag "docs"'))).toBe(true);
    expect(repaired.groups).toEqual([
      {
        files: ['README.md', 'skills/mykit/SKILL.md'],
        tag: 'docs',
        rationale: 'add mykit feature; forced by path tag rules',
      },
      {
        files: ['src/feature.js'],
        tag: 'feat',
        rationale: 'add mykit feature',
      },
    ]);
    expect(validateCommitGroupPlan(repaired, files, cfg).ok).toBe(true);
  });
});

describe('validateCommitGroupPlan', () => {
  const cfg = {
    tags: { enabled: true, list: ['docs'] },
    ignore: { tagsForPaths: { '*.md': 'docs' } },
  };

  test('passes complete partition', () => {
    const plan = {
      groups: [
        { files: ['CHANGELOG.en.md', 'CHANGELOG.ko.md'], tag: 'docs', rationale: 'locale' },
        { files: ['src/a.js'], tag: null, rationale: '' },
      ],
    };
    const files = ['CHANGELOG.en.md', 'CHANGELOG.ko.md', 'src/a.js'];
    const result = validateCommitGroupPlan(plan, files, cfg);
    expect(result.ok).toBe(true);
  });

  test('fails on duplicate and missing files', () => {
    const plan = {
      groups: [
        { files: ['a.js', 'b.js'], tag: null, rationale: '' },
        { files: ['a.js'], tag: null, rationale: '' },
      ],
    };
    const result = validateCommitGroupPlan(plan, ['a.js', 'b.js', 'c.js'], cfg);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_FILE')).toBe(true);
    expect(result.issues.some((i) => i.code === 'MISSING_FILE')).toBe(true);
  });

  test('expectedGroups oracle', () => {
    const plan = {
      groups: [
        { files: ['CHANGELOG.en.md'], tag: 'docs', rationale: '' },
        { files: ['CHANGELOG.ko.md'], tag: 'docs', rationale: '' },
      ],
    };
    const files = ['CHANGELOG.en.md', 'CHANGELOG.ko.md'];
    const caseMeta = {
      grouping: {
        expectedGroups: [['CHANGELOG.en.md', 'CHANGELOG.ko.md']],
      },
    };
    const result = validateCommitGroupPlan(plan, files, cfg, caseMeta);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'EXPECTED_PARTITION')).toBe(true);
  });
});

describe('shell partition vs plan', () => {
  test('parseCommitGroups matches expected partition', () => {
    const output = [
      'docs: update changelog',
      '```bash',
      'git add CHANGELOG.en.md CHANGELOG.ko.md',
      'git commit -m "docs: update changelog"',
      '```',
    ].join('\n');
    const groups = parseCommitGroups([
      'git add CHANGELOG.en.md CHANGELOG.ko.md',
      'git commit -m "docs: update changelog"',
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].files.sort()).toEqual(['CHANGELOG.en.md', 'CHANGELOG.ko.md']);
  });
});
