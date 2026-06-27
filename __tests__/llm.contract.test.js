import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { jest } from '@jest/globals';
import { loadConfig } from '../src/core/config/load.js';

const stubClient = () => ({
  gen: async () => ({ text: 'mock-response', raw: { mocked: true } }),
});

jest.unstable_mockModule('../src/core/llm/gemini.js', () => ({ default: stubClient }));
jest.unstable_mockModule('../src/core/llm/openai.js', () => ({ default: stubClient }));
jest.unstable_mockModule('../src/core/llm/openrouter.js', () => ({ default: stubClient }));

const { createLLMClient } = await import('../src/core/llm/index.js');

let tmpDir;

async function writeRules(yaml) {
  await fs.mkdir(path.join(tmpDir, '.acommit'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, '.acommit', 'rules.yml'), `${yaml.trim()}\n`, 'utf8');
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acommit-llm-'));
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('rules.yml SSOT for LLM config', () => {
  test.each([
    ['gemini', 'gemini-2.5-flash'],
    ['openai', 'gpt-4o-mini'],
    ['openrouter', 'google/gemini-2.5-flash'],
  ])('loadConfig reads provider=%s and model=%s from rules.yml', async (provider, model) => {
    await writeRules(`llm:\n  provider: ${provider}\n  model: ${model}`);
    const cfg = await loadConfig(tmpDir);
    expect(cfg.llm.provider).toBe(provider);
    expect(cfg.llm.model).toBe(model);
  });

  test('missing rules.yml falls back to normalized defaults', async () => {
    const cfg = await loadConfig(tmpDir);
    expect(cfg.llm.provider).toBe('gemini');
    expect(cfg.llm.model).toBeTruthy();
  });
});

describe('LLM client contract (provider/model from rules.yml, no env keys)', () => {
  test.each([
    ['gemini', 'gemini-2.5-flash'],
    ['openai', 'gpt-4o-mini'],
    ['openrouter', 'google/gemini-2.5-flash'],
  ])('%s client returns {text, raw}', async (provider, model) => {
    await writeRules(`llm:\n  provider: ${provider}\n  model: ${model}`);
    const cfg = await loadConfig(tmpDir);

    const client = await createLLMClient(cfg.llm.provider, { model: cfg.llm.model });
    expect(client).toBeTruthy();
    expect(typeof client.gen).toBe('function');

    const out = await client.gen('hello');
    expect(out).toHaveProperty('text');
    expect(out).toHaveProperty('raw');
    expect(typeof out.text).toBe('string');
    expect(out.text).toBe('mock-response');
  });
});
