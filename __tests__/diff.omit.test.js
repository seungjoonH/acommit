import { normalize, DEFAULTS } from '../src/core/config/schema.js';
import { matchesAnyGlob } from '../src/core/ignore/match.js';
import { LABELS } from '../src/core/constants.js';

describe('diff.omitContent / diff.skip', () => {
  test('defaults include lockfile omitContent and dist skip', () => {
    expect(DEFAULTS.diff.omitContent).toContain('**/package-lock.json');
    expect(DEFAULTS.diff.skip).toContain('dist/**');
    expect(DEFAULTS.ignore.files).toBeUndefined();
  });

  test('legacy ignore.files migrates to omitContent and skip', () => {
    const cfg = normalize({
      ignore: {
        files: ['package-lock.json', '*.lock', 'dist/**', 'custom.bin'],
      },
    });
    expect(cfg.diff.omitContent).toEqual(
      expect.arrayContaining(['package-lock.json', '*.lock', 'custom.bin']),
    );
    expect(cfg.diff.skip).toContain('dist/**');
  });

  test('omitContent globs match nested lockfiles by basename', () => {
    const patterns = DEFAULTS.diff.omitContent;
    expect(matchesAnyGlob(patterns, 'package-lock.json')).toBe(true);
    expect(matchesAnyGlob(patterns, 'web/package-lock.json')).toBe(true);
    expect(matchesAnyGlob(patterns, 'yarn.lock')).toBe(true);
    expect(matchesAnyGlob(patterns, 'src/foo.js')).toBe(false);
  });

  test('skip globs exclude dist paths only', () => {
    const patterns = DEFAULTS.diff.skip;
    expect(matchesAnyGlob(patterns, 'dist/web/index.html')).toBe(true);
    expect(matchesAnyGlob(patterns, 'package-lock.json')).toBe(false);
  });
});

describe('metadata omit labels', () => {
  test('content omitted label is defined', () => {
    expect(LABELS.contentOmitted).toMatch(/CONTENT OMITTED/);
    expect(LABELS.metadataStatus(['modified', 'diff-size=100 chars'])).toContain('modified');
  });
});
