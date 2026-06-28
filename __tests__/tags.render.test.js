import { matchesGlob, resolveForcedTag } from '../src/core/ignore/match.js';
import {
  appendSeparator,
  buildTagPrefix,
  createTagRenderer,
  effectiveScope,
  inferScope,
} from '../src/core/tags/render.js';
import { normalize } from '../src/core/config/schema.js';

describe('ignore/match', () => {
  test('matches ** glob', () => {
    expect(matchesGlob('**/assets/**', 'src/assets/logo.png')).toBe(true);
    expect(matchesGlob('docs/**', 'docs/api.md')).toBe(true);
    expect(matchesGlob('*.lock', 'yarn.lock')).toBe(true);
  });

  test('resolveForcedTag prefers longest pattern', () => {
    const tag = resolveForcedTag('src/assets/logo.png', {
      'src/**': 'feat',
      '**/assets/**': 'image',
    });
    expect(tag).toBe('image');
  });

  test('CHANGELOG locale files resolve to docs from defaults', () => {
    const cfg = normalize({});
    expect(resolveForcedTag('CHANGELOG.en.md', cfg.ignore.tagsForPaths)).toBe('docs');
    expect(resolveForcedTag('CHANGELOG.ko.md', cfg.ignore.tagsForPaths)).toBe('docs');
    expect(resolveForcedTag('README.md', cfg.ignore.tagsForPaths)).toBe('docs');
    expect(resolveForcedTag('src/guide.md', cfg.ignore.tagsForPaths)).toBe('docs');
  });
});

describe('tags/render', () => {
  test('appendSeparator avoids double colon', () => {
    expect(appendSeparator('feat:', ': ')).toBe('feat: ');
    expect(appendSeparator('feat', ': ')).toBe('feat: ');
  });

  test('effectiveScope drops redundant scope', () => {
    expect(effectiveScope('docs', 'docs')).toBe('');
    expect(effectiveScope('feat', 'auth')).toBe('auth');
  });

  test('buildTagPrefix conventional scope', () => {
    const cfg = normalize({
      tags: { style: '{tag}', separator: ': ' },
      conventional: { compatible: true, scope: { enabled: true, inferFromPath: true } },
    });
    expect(buildTagPrefix(cfg, 'fix', 'src/auth/login.js')).toBe('fix(auth): ');
    expect(buildTagPrefix(cfg, 'docs', 'docs/api.md')).toBe('docs: ');
  });

  test('case/bracket without style', () => {
    const cfg = normalize({ tags: { case: 'upper', bracket: 'square', separator: ' ' } });
    expect(cfg.tags.render('feat')).toBe('[FEAT]');
  });
});
