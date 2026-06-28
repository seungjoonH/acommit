import { parseCommitOutput } from '../experiments/eval/lib/parse.js';
import { runChecks } from '../experiments/eval/lib/checks.js';

describe('parseCommitOutput', () => {
  test('plain body line after blank line counts as multi-line body', () => {
    const output = [
      'feat: 할인 적용 기능 추가',
      '',
      '새로운 비용 계산 함수 `applyDiscount` 추가',
      '```bash',
      'git add src/services/billing.js',
      'git commit -m "feat: 할인 적용 기능 추가',
      '',
      '새로운 비용 계산 함수 `applyDiscount` 추가"',
      '```',
    ].join('\n');

    const parsed = parseCommitOutput(output);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].bullets.length).toBeGreaterThan(0);

    const checks = runChecks(output, {
      tags: { enabled: true, list: ['feat'] },
      message: { lang: 'ko', lines: 'multi' },
      grouping: { mode: 'per-file' },
    }, { fileCount: 1 });
    expect(checks.find((c) => c.id === 'message.lines')?.passed).toBe(true);
  });

  test('single commit prefers shell -m over broken narrative split', () => {
    const output = [
      'feat: 할인 적용 기능 추가',
      '',
      '새로운 함수 `applyDiscount` 추가',
      '`applyDiscount`는 총액과 할인율을 받아 할인된 금액 계산',
      '```bash',
      'git add src/services/billing.js',
      'git commit -m "feat: 할인 적용 기능 추가',
      '',
      '- applyDiscount 함수 추가',
      '- 총액과 할인율로 할인 금액 계산"',
      '```',
    ].join('\n');

    const parsed = parseCommitOutput(output);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].bullets.length).toBeGreaterThanOrEqual(2);

    const checks = runChecks(output, {
      tags: { enabled: true, list: ['feat'] },
      message: { lang: 'ko', lines: 'multi' },
      grouping: { mode: 'per-file' },
    }, { fileCount: 1 });
    expect(checks.find((c) => c.id === 'message.lines')?.passed).toBe(true);
  });

  test('expectedGroups partition check', () => {
    const good = [
      'docs: update changelog',
      '```bash',
      'git add CHANGELOG.en.md CHANGELOG.ko.md',
      'git commit -m "docs: update changelog"',
      '```',
    ].join('\n');
    const checks = runChecks(good, {
      tags: { enabled: true, list: ['docs'] },
      grouping: { mode: 'by-similarity' },
    }, {
      grouping: {
        expectedGroups: [['CHANGELOG.en.md', 'CHANGELOG.ko.md']],
      },
    });
    expect(checks.find((c) => c.id === 'grouping.expected-partition')?.passed).toBe(true);

    const bad = [
      'docs: en changelog',
      '```bash',
      'git add CHANGELOG.en.md',
      'git commit -m "docs: en changelog"',
      'git add CHANGELOG.ko.md',
      'git commit -m "docs: ko changelog"',
      '```',
    ].join('\n');
    const badChecks = runChecks(bad, {
      tags: { enabled: true, list: ['docs'] },
      grouping: { mode: 'by-similarity' },
    }, {
      grouping: {
        expectedGroups: [['CHANGELOG.en.md', 'CHANGELOG.ko.md']],
      },
    });
    expect(badChecks.find((c) => c.id === 'grouping.expected-partition')?.passed).toBe(false);
  });
});
