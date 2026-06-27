import {
  GIT_UNSTAGE_ALL,
  buildCommitShellLines,
  isAllowedExecuteCommand,
} from '../src/utils/commitShell.js';

describe('commitShell', () => {
  test('buildCommitShellLines prepends git restore --staged . before git add', () => {
    const lines = buildCommitShellLines(['src/a.js', 'docs/b.md'], 'git commit -m "feat: x"');
    expect(lines).toEqual([
      GIT_UNSTAGE_ALL,
      'git add src/a.js docs/b.md',
      'git commit -m "feat: x"',
    ]);
  });

  test('buildCommitShellLines escapes glob metacharacters in paths', () => {
    const lines = buildCommitShellLines(['src/foo(bar).js'], 'git commit -m "fix"');
    expect(lines[1]).toBe('git add src/foo\\(bar\\).js');
  });

  test('isAllowedExecuteCommand allows restore, add, commit', () => {
    expect(isAllowedExecuteCommand(GIT_UNSTAGE_ALL)).toBe(true);
    expect(isAllowedExecuteCommand('git add foo.js')).toBe(true);
    expect(isAllowedExecuteCommand('git commit -m "x"')).toBe(true);
    expect(isAllowedExecuteCommand('git push')).toBe(false);
    expect(isAllowedExecuteCommand('git restore --staged foo')).toBe(false);
  });
});
