import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { effectiveLocalSettings, migrateLegacySettings, writeLocalSettings } from '../src/core/settings/local.js';
import { resolveProviderEnvironment } from '../src/core/llm/provider-env.js';
import { listProviderModels } from '../src/core/llm/providers.js';

describe('personal settings and provider SSOT', () => {
  let cwd;
  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'acommit-local-'));
    await fs.mkdir(path.join(cwd, '.acommit'), { recursive: true });
  });
  afterEach(async () => fs.rm(cwd, { recursive: true, force: true }));

  test('local settings override legacy rules and migration is explicit', async () => {
    await fs.writeFile(path.join(cwd, '.acommit', 'rules.yml'), 'llm:\n  provider: openai\n  model: legacy-model\nskill:\n  autoPush: true\n');
    let state = await effectiveLocalSettings(cwd);
    expect(state.effective.api).toEqual({ provider: 'openai', model: 'legacy-model' });
    expect(state.migration.available).toBe(true);

    const migrated = await migrateLegacySettings(cwd);
    expect(migrated.migrated).toBe(true);
    await writeLocalSettings(cwd, { api: { provider: 'gemini', model: 'personal-model' } });
    state = await effectiveLocalSettings(cwd);
    expect(state.effective.api).toEqual({ provider: 'gemini', model: 'personal-model' });
  });

  test('environment precedence prefers process and ACOMMIT prefix without exposing value', async () => {
    await fs.writeFile(path.join(cwd, '.env'), 'ACOMMIT_OPENAI_API_KEY=project-secret\n');
    const status = await resolveProviderEnvironment(cwd, 'openai', {
      OPENAI_API_KEY: 'process-standard',
      ACOMMIT_OPENAI_API_KEY: 'process-prefixed',
    });
    expect(status).toMatchObject({ configured: true, source: 'process', variable: 'ACOMMIT_OPENAI_API_KEY' });
    expect(JSON.stringify(status)).not.toContain('secret');
    expect(JSON.stringify(status)).not.toContain('process-prefixed');
  });

  test.each([
    ['gemini', { models: [{ name: 'models/a', supportedGenerationMethods: ['generateContent'] }] }, ['a']],
    ['openai', { data: [{ id: 'b' }] }, ['b']],
    ['openrouter', { data: [{ id: 'vendor/c' }] }, ['vendor/c']],
  ])('discovers %s models dynamically', async (provider, body, expected) => {
    const models = await listProviderModels(provider, 'key', {
      fetchImpl: async () => ({ ok: true, json: async () => body }),
    });
    expect(models).toEqual(expected);
  });
});
