import * as clack from '@clack/prompts';
import pc from 'picocolors';
import logger from '../utils/logger.js';

/** @typedef {{ enter(): void, finish(message?: string): void, cancel(message?: string): void }} TuiSession */

/** wizard — intro 한 번, finish/cancel 로 outro */
export function createTuiSession(title = 'acommit') {
  let active = false;
  return {
    enter() {
      if (!active) {
        clack.intro(pc.cyan(title));
        active = true;
      }
    },
    finish(message = '') {
      if (active) {
        clack.outro(message);
        active = false;
      }
    },
    cancel(message = 'Cancelled') {
      if (active) {
        clack.cancel(message);
        active = false;
      }
    },
  };
}

function buildMessage({ step, subtitle, title }) {
  const parts = [];
  if (step) parts.push(step);
  if (subtitle) parts.push(subtitle);
  if (parts.length) return parts.join(' - ');
  return title ?? 'Choose';
}

/**
 * @clack/prompts select — ◆ 질문, ●/○ 옵션, ┌└ 박스
 * @param {{
 *   title?: string,
 *   subtitle?: string,
 *   step?: string,
 *   options: Array<{ value: string, label: string, hint?: string }>,
 *   initialValue?: string,
 *   session?: TuiSession,
 * }} params
 * @returns {Promise<string|null>}
 */
export async function selectOption({
  title = 'acommit',
  subtitle,
  step,
  options,
  initialValue,
  session,
} = {}) {
  if (!Array.isArray(options) || !options.length) return null;

  if (!process.stdin.isTTY) {
    logger.error('Interactive selection requires a TTY. Pass explicit CLI flags instead.');
    return null;
  }

  if (session) {
    session.enter();
  } else {
    clack.intro(pc.cyan(title));
  }

  const choice = await clack.select({
    message: buildMessage({ step, subtitle, title }),
    options: options.map((o) => ({
      value: o.value,
      label: o.label,
      hint: o.hint,
    })),
    initialValue,
  });

  if (clack.isCancel(choice)) return null;
  return choice;
}

export { pc, clack };
