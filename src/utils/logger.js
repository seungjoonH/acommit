const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, VERBOSE: 3 };
let currentLevel = LEVELS.INFO;

function colorWrap(text, colorCode) {
  const reset = '\u001b[0m';
  return `${colorCode}${text}${reset}`;
}

function shouldLog(level) {
  return level <= currentLevel;
}

function formatPrefix(levelName) {
  const bold = '\u001b[1m';
  return `${bold}[acommit] ${levelName}:`;
}

function formatArgs(args) {
  if (!args || args.length === 0) return '';
  // Map functions to a placeholder to avoid printing function bodies
  return args.map(a => {
    if (typeof a === 'function') return '[Function]';
    if (a === undefined) return '<undefined>';
    if (a === null) return '<null>';
    // Mask likely secrets: long strings without whitespace (common API keys)
    if (typeof a === 'string') {
      const s = a;
      if (s.length > 20 && !/\s/.test(s)) {
        // show first 6 and last 4
        return `${s.slice(0,6)}...${s.slice(-4)}`;
      }
    }
    return String(a);
  }).join(' ');
}

export function setLevel(name) {
  const n = (name || '').toString().toUpperCase();
  if (n in LEVELS) currentLevel = LEVELS[n];
}

export function getLevel() {
  return Object.keys(LEVELS).find((k) => LEVELS[k] === currentLevel) || 'INFO';
}

export function error(message, { exit = true, code = 1 } = {}) {
  if (!shouldLog(LEVELS.ERROR)) return;
  const red = '\u001b[31m';
  const prefix = formatPrefix('ERROR');
  const msg = typeof message === 'string' ? message : formatArgs([message]);
  console.error(`${colorWrap(prefix, red)} ${colorWrap(String(msg), red)}`);
  if (exit) process.exit(code);
}

export function warn(...message) {
  if (!shouldLog(LEVELS.WARN)) return;
  const yellow = '\u001b[33m';
  const prefix = formatPrefix('WARN');
  console.error(`${colorWrap(prefix, yellow)} ${colorWrap(formatArgs(message), yellow)}`);
}

export function info(...message) {
  if (!shouldLog(LEVELS.INFO)) return;
  const cyan = '\u001b[36m';
  const prefix = formatPrefix('INFO');
  console.log(`${colorWrap(prefix, cyan)} ${formatArgs(message)}`);
}

export function verbose(...message) {
  if (!shouldLog(LEVELS.VERBOSE)) return;
  const magenta = '\u001b[35m';
  const prefix = formatPrefix('VERBOSE');
  console.log(`${colorWrap(prefix, magenta)} ${formatArgs(message)}`);
}

export default {
  setLevel,
  getLevel,
  error,
  warn,
  info,
  verbose,
  LEVELS
};
