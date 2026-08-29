import {
  GIT_UNSTAGE_ALL,
  buildCommitShellLines,
  extractIgnoredPathsFromGitAddError,
  formatIgnoredGitAddError,
  isAllowedExecuteCommand,
  parseGitAddCommand,
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

  test('parseGitAddCommand extracts paths and force flag', () => {
    expect(parseGitAddCommand('git add node_modules src/foo\\(bar\\).js')).toEqual({
      force: false,
      paths: ['node_modules', 'src/foo(bar).js'],
    });
    expect(parseGitAddCommand('git add -f node_modules')).toEqual({
      force: true,
      paths: ['node_modules'],
    });
    expect(parseGitAddCommand('git commit -m "x"')).toBeNull();
  });

  test('extracts and formats ignored git add errors', () => {
    const stderr = [
      'The following paths are ignored by one of your .gitignore files:',
      'node_modules',
      'hint: Use -f if you really want to add them.',
    ].join('\n');

    expect(extractIgnoredPathsFromGitAddError(stderr)).toEqual(['node_modules']);
    expect(formatIgnoredGitAddError(['node_modules'])).toContain('커밋할 수 없는 경로');
    expect(formatIgnoredGitAddError(['node_modules'])).toContain('git add -f');
  });
});
