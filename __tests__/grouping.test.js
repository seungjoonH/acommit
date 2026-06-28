import {
  groupFilePaths,
  localeNeutralBasename,
  computeFileSimilarity,
  pathSegmentSimilarity,
} from '../src/core/grouping/group.js';
import { normalize } from '../src/core/config/schema.js';

const simCfg = normalize({
  grouping: {
    mode: 'by-similarity',
    threshold: 0.6,
    minFilesPerGroup: 2,
    markdownSameDirSimilarity: 0.55,
  },
});

describe('computeFileSimilarity', () => {
  test('locale pair always 1.0', () => {
    expect(computeFileSimilarity('CHANGELOG.en.md', 'CHANGELOG.ko.md', simCfg)).toBe(1);
  });

  test('different markdown basenames use markdownSameDirSimilarity', () => {
    expect(computeFileSimilarity('README.md', 'CHANGELOG.md', simCfg)).toBe(0.55);
    expect(computeFileSimilarity('README.md', 'LICENSE.md', simCfg)).toBe(0.55);
  });

  test('markdownSameDirSimilarity 0 disables co-location (locale pairs still 1)', () => {
    const cfg = normalize({
      grouping: { markdownSameDirSimilarity: 0, threshold: 0.6 },
    });
    expect(computeFileSimilarity('README.md', 'CHANGELOG.md', cfg)).toBe(0);
    expect(computeFileSimilarity('CHANGELOG.en.md', 'CHANGELOG.ko.md', cfg)).toBe(1);
  });

  test('markdownSameDirSimilarity 1 clusters any same-dir md', () => {
    const cfg = normalize({ grouping: { markdownSameDirSimilarity: 1 } });
    expect(computeFileSimilarity('README.md', 'LICENSE.md', cfg)).toBe(1);
  });

  test('different directories: path segments only', () => {
    expect(pathSegmentSimilarity('README.md', 'docs/guide.md')).toBe(0);
    expect(computeFileSimilarity('README.md', 'docs/guide.md', simCfg)).toBe(0);
  });
});

describe('groupFilePaths', () => {
  test('per-file returns one path per group', () => {
    const groups = groupFilePaths(['b.js', 'a.js'], { grouping: { mode: 'per-file' } });
    expect(groups).toEqual([['a.js'], ['b.js']]);
  });

  test('by-directory merges same directory', () => {
    const groups = groupFilePaths(
      ['src/a.js', 'src/b.js', 'docs/x.md'],
      { grouping: { mode: 'by-directory', directoryDepth: 1, minFilesPerGroup: 2 } },
    );
    const flat = groups.map((g) => g.join(',')).sort();
    expect(flat).toEqual(['docs/x.md', 'src/a.js,src/b.js']);
  });

  test('by-directory keeps all same-dir files in one group', () => {
    const files = Array.from({ length: 25 }, (_, i) => `eval/f${i}.js`);
    const groups = groupFilePaths(files, {
      grouping: {
        mode: 'by-directory',
        directoryDepth: 1,
        minFilesPerGroup: 1,
      },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(25);
  });

  test('by-similarity splits dissimilar paths', () => {
    const groups = groupFilePaths(
      ['web/src/App.jsx', 'src/cli.js', 'eval/run.mjs'],
      { grouping: { mode: 'by-similarity', threshold: 0.6, minFilesPerGroup: 2 } },
    );
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  test('locale-neutral basename pairs CHANGELOG.en/ko', () => {
    expect(localeNeutralBasename('CHANGELOG.en.md')).toBe('CHANGELOG.md');
    expect(localeNeutralBasename('CHANGELOG.ko.md')).toBe('CHANGELOG.md');
  });

  test('by-similarity always groups locale pair', () => {
    const groups = groupFilePaths(
      ['CHANGELOG.en.md', 'CHANGELOG.ko.md'],
      simCfg,
    );
    expect(groups).toEqual([['CHANGELOG.en.md', 'CHANGELOG.ko.md']]);
  });

  test('by-similarity splits README CHANGELOG LICENSE at default threshold', () => {
    const groups = groupFilePaths(
      ['README.md', 'CHANGELOG.md', 'LICENSE.md'],
      simCfg,
    );
    expect(groups).toEqual([['CHANGELOG.md'], ['LICENSE.md'], ['README.md']]);
  });

  test('by-similarity merges meta markdown when threshold <= markdownSameDirSimilarity', () => {
    const cfg = normalize({
      grouping: {
        mode: 'by-similarity',
        threshold: 0.5,
        minFilesPerGroup: 2,
        markdownSameDirSimilarity: 0.55,
      },
    });
    const groups = groupFilePaths(
      ['README.md', 'CHANGELOG.md', 'LICENSE.md'],
      cfg,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(['CHANGELOG.md', 'LICENSE.md', 'README.md']);
  });

  test('by-similarity merges meta markdown when markdownSameDirSimilarity is 1', () => {
    const cfg = normalize({
      grouping: {
        mode: 'by-similarity',
        threshold: 0.6,
        minFilesPerGroup: 2,
        markdownSameDirSimilarity: 1,
      },
    });
    const groups = groupFilePaths(
      ['README.md', 'CHANGELOG.en.md', 'CHANGELOG.ko.md', 'LICENSE.md'],
      cfg,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(['CHANGELOG.en.md', 'CHANGELOG.ko.md', 'LICENSE.md', 'README.md']);
  });

  test('by-directory groups repo-root locale pair', () => {
    const groups = groupFilePaths(
      ['CHANGELOG.en.md', 'CHANGELOG.ko.md'],
      { grouping: { mode: 'by-directory', directoryDepth: 1, minFilesPerGroup: 2 } },
    );
    expect(groups).toEqual([['CHANGELOG.en.md', 'CHANGELOG.ko.md']]);
  });

  test('by-similarity keeps markdown in different directories separate', () => {
    const groups = groupFilePaths(
      ['README.md', 'docs/guide.md'],
      simCfg,
    );
    expect(groups).toEqual([['README.md'], ['docs/guide.md']]);
  });
});
