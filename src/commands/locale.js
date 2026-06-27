import * as clack from '@clack/prompts';
import { readLocale, writeLocale } from '../core/locale.js';
import { initStrings } from '../ui/init-i18n.js';
import { createTuiSession, pc } from '../ui/tui.js';
import logger from '../utils/logger.js';

export async function localeCommand({ set: setValue } = {}) {
  const cwd = process.cwd();
  const current = await readLocale(cwd);

  // Non-interactive: acommit locale ko / acommit locale en
  if (setValue) {
    const normalized = setValue.toLowerCase() === 'en' ? 'en' : 'ko';
    await writeLocale(cwd, normalized);
    const t = initStrings(normalized);
    logger.info(t.localeCmd.saved(normalized));
    return;
  }

  if (!process.stdin.isTTY) {
    const t = initStrings(current);
    logger.info(t.localeCmd.current(current));
    return;
  }

  const t = initStrings(current);
  const tui = createTuiSession(t.localeCmd.title);
  tui.enter();

  const chosen = await clack.select({
    message: t.localeCmd.subtitle,
    initialValue: current,
    options: t.localeCmd.options,
  });

  if (clack.isCancel(chosen)) {
    tui.cancel(t.localeCmd.cancel);
    return;
  }

  await writeLocale(cwd, chosen);
  // Use strings in the newly selected locale for the finish message
  const tNew = initStrings(chosen);
  tui.finish(pc.green(tNew.localeCmd.saved(chosen)));
}

export default localeCommand;
