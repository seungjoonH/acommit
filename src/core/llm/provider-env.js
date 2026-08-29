import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { providerDefinition, listProviderModels as fetchProviderModels } from './providers.js';

async function readEnvFile(file) {
  try { return dotenv.parse(await fs.readFile(file, 'utf8')); } catch { return {}; }
}

export async function resolveProviderEnvironment(cwd, provider, processEnv = process.env) {
  const def = providerDefinition(provider);
  if (!def) return { validProvider: false, configured: false, source: null, missing: ['provider'] };
  const names = [`ACOMMIT_${def.keyName}`, def.keyName];
  const sources = [['process', processEnv], ['project', await readEnvFile(path.join(cwd, '.env'))], ['global', await readEnvFile(path.join(os.homedir(), '.acommit', '.env'))]];
  for (const [source, values] of sources) {
    for (const name of names) if (values[name]) return { validProvider: true, configured: true, source, variable: name, missing: [] };
  }
  return { validProvider: true, configured: false, source: null, variable: names[0], missing: [names[0]] };
}

export async function providerSecret(cwd, provider, processEnv = process.env) {
  const status = await resolveProviderEnvironment(cwd, provider, processEnv);
  if (!status.configured) return '';
  if (status.source === 'process') return processEnv[status.variable] || '';
  const file = status.source === 'project' ? path.join(cwd, '.env') : path.join(os.homedir(), '.acommit', '.env');
  return (await readEnvFile(file))[status.variable] || '';
}

export async function listProviderModels(cwd, provider, options = {}) {
  return fetchProviderModels(provider, await providerSecret(cwd, provider), options);
}
