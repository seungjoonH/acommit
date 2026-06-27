import { groupFilePaths } from '../src/core/grouping/group.js';

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

  test('by-similarity splits dissimilar paths', () => {
    const groups = groupFilePaths(
      ['web/src/App.jsx', 'src/cli.js', 'eval/run.mjs'],
      { grouping: { mode: 'by-similarity', threshold: 0.6, minFilesPerGroup: 2, maxGroupSize: 10 } },
    );
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });
});
