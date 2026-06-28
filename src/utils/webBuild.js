import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import logger from './logger.js';

const execFileAsync = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const WEB_DIST = path.join(ROOT, 'dist/web/index.html');
const WEB_SRC = path.join(ROOT, 'web/src');
const WEB_PKG = path.join(ROOT, 'web/package.json');

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function newestMtime(dir) {
  let max = 0;
  async function walk(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) await walk(fp);
      else {
        const st = await fs.stat(fp);
        if (st.mtimeMs > max) max = st.mtimeMs;
      }
    }
  }
  await walk(dir);
  return max;
}

export async function ensureWebBuild() {
  if (process.env.ACOMMIT_SKIP_WEB_BUILD === '1') return;

  const hasDist = await pathExists(WEB_DIST);
  const hasSrc = await pathExists(WEB_SRC);

  // Published npm package ships dist/web only — no web/src to rebuild from.
  if (!hasSrc) {
    if (!hasDist) {
      throw new Error(
        'Web UI bundle missing (dist/web). Reinstall acommit or build from source.',
      );
    }
    return;
  }

  let distMtime = 0;
  if (hasDist) {
    distMtime = (await fs.stat(WEB_DIST)).mtimeMs;
  }
  const srcMtime = await newestMtime(WEB_SRC);
  if (hasDist && srcMtime <= distMtime) return;

  if (!(await pathExists(WEB_PKG))) {
    throw new Error('web/package.json not found — cannot rebuild Web UI');
  }

  logger.info('Web UI changed — rebuilding…');
  await execFileAsync('npm', ['run', 'build:web'], { cwd: ROOT });
}
