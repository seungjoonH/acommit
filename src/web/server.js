import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { normalize, DEFAULTS } from '../core/config/schema.js';
import { MESSAGE_STYLES_BY_LANG } from '../core/message/styles.js';
import { readLocale } from '../core/locale.js';
import { catalogForApi } from '../core/llm/catalog.js';
import {
  extractIgnoredPathsFromGitAddError,
  formatIgnoredGitAddError,
  formatIgnoredGitAddSkip,
  formatSkippedCommitAfterIgnoredAdd,
  isAllowedExecuteCommand,
  parseGitAddCommand,
} from '../utils/commitShell.js';

const execAsync = promisify(execCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '../../dist/web');

// ── Helpers ───────────────────────────────────────────────────

function rulesPath(cwd) { return path.join(cwd, '.acommit', 'rules.yml'); }
function sessionsDir(cwd) { return path.join(cwd, '.acommit', 'results', 'commits'); }

async function readRules(cwd) {
  try { return YAML.parse(await fs.readFile(rulesPath(cwd), 'utf8')) ?? {}; }
  catch { return {}; }
}

function toSerializable(cfg) {
  const out = { ...cfg };
  if (out.tags) { const { render, ...rest } = out.tags; out.tags = rest; }
  return out;
}

function schemaMetadata() {
  return {
    tags: {
      styleTemplates: ['{tag}', '[{TAG}]', '{Tag}', '{tag}({scope})', '[{TAG}]{sep}'],
      cases: ['lower', 'upper', 'capitalize'],
      brackets: ['none', 'square', 'round'],
      defaultList: DEFAULTS.tags.list,
    },
    message: {
      langs: ['ko', 'en'],
      styles: ['verb', 'declarative', 'imperative', 'past'],
      stylesByLang: MESSAGE_STYLES_BY_LANG,
      tones: ['concise', 'detailed'],
      lines: ['single', 'multi'],
    },
    grouping: { modes: ['per-file', 'by-tag', 'by-directory', 'by-similarity', 'none'] },
    llm: { catalog: catalogForApi() },
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify(body));
}

async function serveStatic(res, urlPath) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(STATIC_DIR, safePath);
  if (!filePath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json',
      '.woff2': 'font/woff2',
    };
    res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const html = await fs.readFile(path.join(STATIC_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch { res.writeHead(404); res.end('Not found'); }
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ── Sessions API ──────────────────────────────────────────────

const SESSION_ID_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

async function listSessions(cwd) {
  const dir = sessionsDir(cwd);
  try {
    const entries = await fs.readdir(dir);
    const jsonFiles = entries.filter(f => f.endsWith('.json')).sort().reverse();
    const sessions = await Promise.all(
      jsonFiles.map(async (f) => {
        try {
          const raw = await fs.readFile(path.join(dir, f), 'utf8');
          const s = JSON.parse(raw);
          return {
            id: s.id,
            timestamp: s.timestamp,
            provider: s.provider,
            model: s.model,
            groupingMode: s.groupingMode,
            commitCount: Array.isArray(s.commits) ? s.commits.length : 0,
          };
        } catch { return null; }
      })
    );
    return sessions.filter(Boolean);
  } catch { return []; }
}

async function getSession(cwd, id) {
  if (!SESSION_ID_RE.test(id)) return null;
  const file = path.join(sessionsDir(cwd), `${id}.json`);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return null; }
}

// ── Execute API ───────────────────────────────────────────────

async function executeCommands(commands, cwd) {
  const results = [];
  let skipNextCommitForIgnored = null;

  for (const command of commands) {
    if (skipNextCommitForIgnored && /^git commit\b/.test(String(command ?? '').trim())) {
      results.push({
        command,
        stdout: formatSkippedCommitAfterIgnoredAdd(skipNextCommitForIgnored),
        stderr: '',
        exitCode: 0,
        ok: true,
      });
      skipNextCommitForIgnored = null;
      continue;
    }
    skipNextCommitForIgnored = null;

    if (!isAllowedExecuteCommand(command)) {
      results.push({ command, stdout: '', stderr: 'Blocked: only git restore --staged . / add / commit allowed', exitCode: 1, ok: false });
      return { results, aborted: true };
    }
    const addPaths = await partitionGitAddPaths(command, cwd);
    const ignored = addPaths?.ignored ?? [];
    if (ignored.length) {
      if (!addPaths.remaining.length) {
        skipNextCommitForIgnored = ignored;
        results.push({
          command,
          stdout: formatIgnoredGitAddSkip(ignored),
          stderr: '',
          exitCode: 0,
          ok: true,
        });
        continue;
      }
    }

    const commandToRun = addPaths?.remaining?.length
      ? `git add ${addPaths.remaining.map(shellQuote).join(' ')}`
      : command;
    const prefix = ignored.length ? formatIgnoredGitAddSkip(ignored) : '';

    try {
      const { stdout, stderr } = await execAsync(commandToRun, { cwd, timeout: 30_000 });
      results.push({
        command,
        stdout: [prefix, stdout.trim()].filter(Boolean).join('\n'),
        stderr: stderr.trim(),
        exitCode: 0,
        ok: true,
      });
    } catch (err) {
      const exitCode = err.code ?? 1;
      const rawStderr = (err.stderr ?? err.message).trim();
      const ignoredFromGit = extractIgnoredPathsFromGitAddError(rawStderr);
      results.push({
        command,
        stdout: (err.stdout ?? '').trim(),
        stderr: ignoredFromGit.length ? formatIgnoredGitAddError(ignoredFromGit) : rawStderr,
        exitCode,
        ok: false,
      });
      return { results, aborted: true };
    }
  }
  return { results, aborted: false };
}

async function partitionGitAddPaths(command, cwd) {
  const parsed = parseGitAddCommand(command);
  if (!parsed || parsed.force || !parsed.paths.length) return null;

  const ignored = [];
  const remaining = [];
  for (const filePath of parsed.paths) {
    try {
      await execAsync(`git check-ignore -q -- ${shellQuote(filePath)}`, { cwd, timeout: 30_000 });
      ignored.push(filePath);
    } catch {
      // git check-ignore exits non-zero when the path is not ignored.
      remaining.push(filePath);
    }
  }
  return { ignored, remaining };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// ── Server ────────────────────────────────────────────────────

export function createServer(cwd, { port = 3000 } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // ── Rules API ──
    if (pathname === '/api/rules') {
      if (req.method === 'GET') {
        const cfg = normalize(await readRules(cwd));
        send(res, 200, toSerializable(cfg));
        return;
      }
      if (req.method === 'PUT') {
        try {
          const incoming = JSON.parse(await readBody(req));
          const cfg = normalize(incoming);
          const serializable = toSerializable(cfg);
          if (!Array.isArray(serializable.tags?.list)) {
            send(res, 400, { error: 'tags.list must be an array' }); return;
          }
          const dir = path.join(cwd, '.acommit');
          await fs.mkdir(dir, { recursive: true });
          const fp = rulesPath(cwd);
          try { await fs.writeFile(fp + '.bak', await fs.readFile(fp, 'utf8'), 'utf8'); } catch {}
          await fs.writeFile(fp, YAML.stringify(serializable), 'utf8');
          send(res, 200, { ok: true });
        } catch (err) { send(res, 400, { error: err.message }); }
        return;
      }
    }

    if (pathname === '/api/locale' && req.method === 'GET') {
      send(res, 200, { locale: await readLocale(cwd) });
      return;
    }

    if (pathname === '/api/schema' && req.method === 'GET') {
      send(res, 200, schemaMetadata());
      return;
    }

    // ── Sessions API ──
    if (pathname === '/api/sessions' && req.method === 'GET') {
      send(res, 200, await listSessions(cwd));
      return;
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/(.+)$/);
    if (sessionMatch && req.method === 'GET') {
      const session = await getSession(cwd, sessionMatch[1]);
      if (!session) { send(res, 404, { error: 'Not found' }); return; }
      send(res, 200, session);
      return;
    }

    // ── Execute API ──
    if (pathname === '/api/execute' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req));
        if (!Array.isArray(body.commands)) {
          send(res, 400, { error: 'commands must be an array' }); return;
        }
        const result = await executeCommands(body.commands, cwd);
        send(res, 200, result);
      } catch (err) { send(res, 400, { error: err.message }); }
      return;
    }

    await serveStatic(res, pathname);
  });

  return server;
}

export async function startServer(cwd, { port = 3000 } = {}) {
  for (let p = port; p <= port + 10; p++) {
    const server = createServer(cwd, { port: p });
    try {
      await new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(p, '127.0.0.1', resolve);
      });
      return { server, port: p };
    } catch (err) {
      server.closeAllConnections?.();
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error(`Ports ${port}–${port + 10} are all in use.`);
}
