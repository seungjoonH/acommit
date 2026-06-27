import { createServer } from '../src/web/server.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

let server;
let port;
let tmpDir;
let base;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acommit-test-'));
  port = 13099;
  server = createServer(tmpDir, { port });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/rules', () => {
  test('returns 200 with default config when no rules.yml exists', async () => {
    const res = await fetch(`${base}/api/rules`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message.lang).toBe('ko');
    expect(body.tags.enabled).toBe(true);
    expect(Array.isArray(body.tags.list)).toBe(true);
    expect(body.grouping.mode).toBe('per-file');
    // render function is stripped
    expect(body.tags.render).toBeUndefined();
  });
});

describe('PUT /api/rules', () => {
  test('saves rules.yml and returns 200', async () => {
    const payload = {
      message: { lang: 'en', style: 'imperative', tone: 'concise', lines: 'single', wrap: 80, emoji: { enabled: false, map: {} } },
      tags: { enabled: true, list: ['feat', 'fix'], style: '[{TAG}]', separator: ' ', case: 'upper', bracket: 'square' },
      grouping: { mode: 'by-tag', directoryDepth: 1, minFilesPerGroup: 2, threshold: 0.6, maxGroupSize: 10 },
      diff: { includeBinary: false, untrackedSizeLimit: 512000, omitContent: ['*.lock'], skip: ['dist/**'] },
      ignore: { tagsForPaths: {} },
      conventional: { compatible: false, scope: { enabled: false, inferFromPath: true } },
      llm: { provider: 'openai', model: 'gpt-4o-mini', maxOutputTokens: 4000, maxPromptTokens: 100000 },
    };

    const res = await fetch(`${base}/api/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // File should exist
    const rulesFile = path.join(tmpDir, '.acommit', 'rules.yml');
    const stat = await fs.stat(rulesFile);
    expect(stat.isFile()).toBe(true);
  });

  test('GET after PUT returns updated values', async () => {
    const res = await fetch(`${base}/api/rules`);
    const body = await res.json();
    expect(body.message.lang).toBe('en');
    expect(body.tags.list).toEqual(['feat', 'fix']);
    expect(body.grouping.mode).toBe('by-tag');
    expect(body.llm.provider).toBe('openai');
  });

  test('PUT creates .acommit/rules.yml.bak on second save', async () => {
    const payload = { message: { lang: 'ko' } };
    await fetch(`${base}/api/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const bakFile = path.join(tmpDir, '.acommit', 'rules.yml.bak');
    const stat = await fs.stat(bakFile);
    expect(stat.isFile()).toBe(true);
  });

  test('PUT with invalid body returns 400', async () => {
    const res = await fetch(`${base}/api/rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/locale', () => {
  test('returns default locale when no locale file exists', async () => {
    const res = await fetch(`${base}/api/locale`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locale).toBe('en');
  });

  test('returns saved locale from .acommit/locale', async () => {
    await fs.mkdir(path.join(tmpDir, '.acommit'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.acommit', 'locale'), 'ko\n', 'utf8');
    const res = await fetch(`${base}/api/locale`);
    const body = await res.json();
    expect(body.locale).toBe('ko');
  });
});

describe('GET /api/schema', () => {
  test('returns schema metadata', async () => {
    const res = await fetch(`${base}/api/schema`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grouping.modes).toContain('per-file');
    expect(body.llm.catalog.routes.direct.label).toBe('Direct API');
    expect(body.llm.catalog.vendors.openrouter).toBeTruthy();
  });
});

describe('Static files', () => {
  test('GET / returns HTML', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  test('unknown path falls back to index.html (SPA)', async () => {
    const res = await fetch(`${base}/some/deep/route`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  test('path traversal is blocked', async () => {
    const res = await fetch(`${base}/../../etc/passwd`);
    expect(res.status).toBe(200); // SPA fallback, not 403, but must not serve the file
    const text = await res.text();
    expect(text).not.toContain('root:');
  });
});
