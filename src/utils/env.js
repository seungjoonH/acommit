import dotenv from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const loadedCwds = new Set();

export function loadEnv(cwd = process.cwd()) {
  const resolved = path.resolve(cwd);
  if (loadedCwds.has(resolved)) return;
  loadedCwds.add(resolved);

  const candidates = [path.join(cwd, '.env'), path.join(os.homedir(), '.acommit', '.env')];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const parsed = dotenv.parse(fs.readFileSync(file));
        for (const [key, value] of Object.entries(parsed)) {
          if (process.env[key] === undefined) process.env[key] = value;
        }
      }
    } catch {
      // ignore unreadable .env files
    }
  }
}

/**
 * Read an env var, preferring ACOMMIT_<NAME> over <NAME>.
 * Example: env('GEMINI_API_KEY') → ACOMMIT_GEMINI_API_KEY || GEMINI_API_KEY
 */
export function env(name) {
  const key = String(name || '').trim();
  if (!key) return '';
  const prefixed = key.startsWith('ACOMMIT_') ? key : `ACOMMIT_${key}`;
  return process.env[prefixed] || process.env[key] || '';
}

loadEnv();
