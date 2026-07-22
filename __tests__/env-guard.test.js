import {
  ENV_GITIGNORE_PATTERNS,
  isIgnoredByGitignore,
  isSensitiveEnvPath,
  missingEnvGitignorePatterns,
} from '../src/core/safety/env-guard.js';

describe('env safety guard', () => {
  test('detects sensitive env files and allows shareable examples', () => {
    expect(isSensitiveEnvPath('.env')).toBe(true);
    expect(isSensitiveEnvPath('.env.local')).toBe(true);
    expect(isSensitiveEnvPath('.env.prod')).toBe(true);
    expect(isSensitiveEnvPath('.env.dev')).toBe(true);
    expect(isSensitiveEnvPath('.env.development')).toBe(true);
    expect(isSensitiveEnvPath('.env.production')).toBe(true);
    expect(isSensitiveEnvPath('apps/api/.env.local')).toBe(true);

    expect(isSensitiveEnvPath('.env.example')).toBe(false);
    expect(isSensitiveEnvPath('.env.sample')).toBe(false);
    expect(isSensitiveEnvPath('.env.template')).toBe(false);
    expect(isSensitiveEnvPath('.env.production.example')).toBe(false);
    expect(isSensitiveEnvPath('.envrc')).toBe(false);
  });

  test('gitignore protection covers nested env files and unignores examples', () => {
    const content = `${ENV_GITIGNORE_PATTERNS.join('\n')}\n`;

    expect(isIgnoredByGitignore('.env', content)).toBe(true);
    expect(isIgnoredByGitignore('.env.local', content)).toBe(true);
    expect(isIgnoredByGitignore('apps/api/.env.production', content)).toBe(true);

    expect(isIgnoredByGitignore('.env.example', content)).toBe(false);
    expect(isIgnoredByGitignore('apps/api/.env.production.example', content)).toBe(false);
  });

  test('reports missing env protection patterns', () => {
    const content = '.acommit/results/\n.env\n';
    const missing = missingEnvGitignorePatterns(content);

    expect(missing).toContain('.env.*');
    expect(missing).toContain('!.env.example');
    expect(missing).not.toContain('.env');
  });
});
