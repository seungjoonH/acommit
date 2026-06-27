import { listCommitSuites, formatSuiteHint } from '../eval/lib/suite/commit-suites.js';
import { currentGitSha } from '../eval/lib/suite/git.js';

describe('listCommitSuites', () => {
  test('includes HEAD and stored suites', async () => {
    const head = currentGitSha();
    const suites = await listCommitSuites();
    expect(suites.length).toBeGreaterThanOrEqual(1);
    const headEntry = suites.find((s) => s.isHead);
    expect(headEntry?.sha).toBe(head);
    expect(headEntry?.readOnly).toBe(false);
  });

  test('marks non-HEAD suites as read-only', async () => {
    const suites = await listCommitSuites();
    const stored = suites.filter((s) => s.hasData && !s.isHead);
    for (const suite of stored) {
      expect(suite.readOnly).toBe(true);
    }
  });

  test('formatSuiteHint mentions read-only for past commits', () => {
    const hint = formatSuiteHint({
      isHead: false,
      hasData: true,
      runCells: 63,
      totalCells: 63,
      humanScored: 0,
      updatedAt: '2026-06-26T00:00:00.000Z',
      readOnly: true,
    });
    expect(hint).toContain('read-only');
  });
});
