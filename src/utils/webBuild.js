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
  let distMtime = 0;
  try { distMtime = (await fs.stat(WEB_DIST)).mtimeMs; } catch { /* missing */ }
  const srcMtime = await newestMtime(WEB_SRC);
  if (srcMtime <= distMtime) return;
  logger.info('Web UI changed — rebuilding…');
  await execFileAsync('npm', ['run', 'build:web'], { cwd: ROOT });
}
