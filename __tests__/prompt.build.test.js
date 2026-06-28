import { buildPromptFromDiff } from '../src/core/prompt/build.js';
import { normalize } from '../src/core/config/schema.js';

describe('buildPromptFromDiff', () => {
  test('by-directory prompt forbids mixing directory buckets', () => {
    const cfg = normalize({
      grouping: { mode: 'by-directory', directoryDepth: 2, minFilesPerGroup: 2 },
      message: { lang: 'ko' },
    });
    const { system } = buildPromptFromDiff(cfg, '[FILENAME]: apps/admin/a.ts');
    expect(system).toContain('NEVER mix files from different buckets');
    expect(system).toContain('apps/admin/*');
  });

  test('per-file prompt requires separate git add per file', () => {
    const cfg = normalize({ grouping: { mode: 'per-file' }, message: { lang: 'ko' } });
    const { system } = buildPromptFromDiff(cfg, '');
    expect(system).toContain('separate git add + git commit pair for EVERY file');
  });

  test('includes refactor tag heuristic', () => {
    const cfg = normalize({ message: { lang: 'en' } });
    const { system } = buildPromptFromDiff(cfg, '');
    expect(system).toContain('refactor: extract/move/reorganize');
  });

  test('per-group prompt includes tag heuristics and multi-line bullet rules', () => {
    const cfg = normalize({
      grouping: { mode: 'per-file' },
      message: { lang: 'ko', lines: 'multi' },
    });
    const { system } = buildPromptFromDiff(cfg, '', [], { perGroup: true, groupFiles: ['a.js'] });
    expect(system).toContain('refactor: extract/move/reorganize');
    expect(system).toContain('Do NOT use per-file changelog headers');
    expect(system).toContain('NEVER output a bare file path');
    expect(system).toContain('Do NOT infer changes from the file path');
  });

  test('per-group user prompt reminds to use diff hunk not path', () => {
    const cfg = normalize({
      grouping: { mode: 'per-file' },
      message: { lang: 'ko' },
    });
    const { user } = buildPromptFromDiff(cfg, '[FILENAME]: infra/k8s/api.yaml', [], {
      perGroup: true,
      groupFiles: ['infra/k8s/api.yaml'],
    });
    expect(user).toContain('ONLY what the [DIFFERENCES] hunk shows');
  });

  test('restricted tag list overrides path-based tag inference in prompt', () => {
    const cfg = normalize({
      tags: { enabled: true, list: ['feat', 'fix'] },
      message: { lang: 'ko' },
    });
    const { system } = buildPromptFromDiff(cfg, '', [], { perGroup: true, groupFiles: ['docs/guide.md'] });
    expect(system).toContain('allowed=[feat, fix] overrides path/file-type inference');
    expect(system).toContain('docs: is NOT allowed');
  });

  test('per-group declarative ko uses declarative subject example', () => {
    const cfg = normalize({
      grouping: { mode: 'per-file' },
      message: { lang: 'ko', style: 'declarative', lines: 'single' },
    });
    const { system } = buildPromptFromDiff(cfg, '', [], { perGroup: true, groupFiles: ['a.sql'] });
    expect(system).toContain('초기 설정을 추가함');
    expect(system).toContain('example: feat: 초기 설정을 추가함');
    expect(system).toContain('never verb-only endings');
    expect(system).not.toMatch(/example: feat: 초기 설정 추가[^함]/);
  });

  test('per-group verb ko keeps terse subject example', () => {
    const cfg = normalize({
      grouping: { mode: 'per-file' },
      message: { lang: 'ko', style: 'verb', lines: 'single' },
    });
    const { system } = buildPromptFromDiff(cfg, '', [], { perGroup: true, groupFiles: ['a.js'] });
    expect(system).toContain('example: feat: 초기 설정 추가');
    expect(system).not.toContain('초기 설정을 추가함');
  });

  test('per-group prompt includes plan rationale and tag from plan', () => {
    const cfg = normalize({
      grouping: { mode: 'by-similarity' },
      message: { lang: 'en' },
      tags: { enabled: true, list: ['docs'] },
    });
    const { user } = buildPromptFromDiff(cfg, '', [], {
      perGroup: true,
      groupFiles: ['CHANGELOG.en.md', 'CHANGELOG.ko.md'],
      planGroup: { tag: 'docs', rationale: 'locale pair release notes' },
    });
    expect(user).toContain('GROUP INTENT (from plan)');
    expect(user).toContain('locale pair release notes');
    expect(user).toContain('REQUIRED TAG (from plan): docs:');
    expect(user).toContain('Grouping is already fixed');
  });
});
