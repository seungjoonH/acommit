import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_SRC = path.join(ROOT, 'web/src');
const WEB_SRC_BAK = path.join(ROOT, 'web/.src-publish-test-bak');

describe('ensureWebBuild', () => {
  test('uses prebuilt dist when web/src is absent (published npm layout)', async () => {
    let moved = false;
    try {
      await fs.rename(WEB_SRC, WEB_SRC_BAK);
      moved = true;
      const { ensureWebBuild } = await import(`../src/utils/webBuild.js?publish=${Date.now()}`);
      await expect(ensureWebBuild()).resolves.toBeUndefined();
    } finally {
      if (moved) await fs.rename(WEB_SRC_BAK, WEB_SRC);
    }
  });
});
