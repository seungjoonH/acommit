import fs from 'node:fs/promises';
import path from 'node:path';

/** acommit UI locale — CLI copy + rules.yml comment template (not message.lang). */
export const DEFAULT_LOCALE = 'en';

export function normalizeLocale(value) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'ko';
}

export function localeFile(cwd = process.cwd()) {
  return path.join(cwd, '.acommit', 'locale');
}

export async function readLocale(cwd = process.cwd()) {
  try {
    const raw = (await fs.readFile(localeFile(cwd), 'utf8')).trim();
    return normalizeLocale(raw);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function writeLocale(cwd, locale) {
  const dir = path.join(cwd, '.acommit');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(localeFile(cwd), `${normalizeLocale(locale)}\n`, 'utf8');
}
