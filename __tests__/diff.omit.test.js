import { normalize, DEFAULTS } from '../src/core/config/schema.js';
import { DiffCollector } from '../src/core/diff/collector.js';
import { matchesAnyGlob } from '../src/core/ignore/match.js';
import { LABELS } from '../src/core/constants.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

  test('DiffCollector always excludes node_modules even without gitignore', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'acommit-diff-'));
    try {
      await execFileAsync('git', ['init'], { cwd });
      await fs.mkdir(path.join(cwd, 'node_modules/.pnpm/yaml@2.9.0/node_modules/yaml'), { recursive: true });
      await fs.mkdir(path.join(cwd, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(cwd, 'node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/index.js'),
        'module.exports = {};\n',
        'utf8',
      );
      await fs.writeFile(path.join(cwd, 'src/index.js'), 'console.log("ok");\n', 'utf8');

      const dc = new DiffCollector({ cwd, skip: [] });
      await expect(dc.listFiles()).resolves.toEqual(['src/index.js']);
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });
});

describe('metadata omit labels', () => {
  test('content omitted label is defined', () => {
    expect(LABELS.contentOmitted).toMatch(/CONTENT OMITTED/);
    expect(LABELS.metadataStatus(['modified', 'diff-size=100 chars'])).toContain('modified');
  });
});
