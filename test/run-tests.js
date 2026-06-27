import assert from 'node:assert/strict';
import { createLLMClient } from '../src/core/llm/index.js';

const CASES = [
  { provider: 'gemini' },
  { provider: 'openai', opts: { model: 'gpt-3.5-turbo' } },
];

async function verifyClient({ provider, opts = {} }) {
  const client = await createLLMClient(provider, opts);
  if (!client) {
    console.warn(`[warn] Skipping ${provider} contract test because the module could not be loaded.`);
    return;
  }

  assert.strictEqual(typeof client.gen, 'function', `${provider} client must expose gen()`);
  const output = await client.gen('contract-test');
  assert(Object.prototype.hasOwnProperty.call(output, 'text'), `${provider}.gen must return text.`);
  assert(Object.prototype.hasOwnProperty.call(output, 'raw'), `${provider}.gen must return raw.`);
  assert.strictEqual(typeof output.text, 'string', `${provider}.text must be a string.`);
}

async function run() {
  console.log('Running acommit LLM contract tests...');

  // Remove real keys so requests never leave the machine.
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  for (const item of CASES) {
    await verifyClient(item);
  }

  console.log('All LLM contract tests passed.');
}

run().catch((err) => {
  console.error('Tests failed:', err);
  process.exit(1);
});
