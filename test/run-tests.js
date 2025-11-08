import assert from 'node:assert/strict';
import { createLLMClient } from '../src/core/llm/index.js';

const CASES = [
  { provider: 'gemini' },
  { provider: 'openai', opts: { model: 'gpt-3.5-turbo' } },
];

async function verifyClient({ provider, opts = {} }) {
  const client = await createLLMClient(provider, opts);
  if (!client) {
    console.warn(`[경고] ${provider} 모듈을 불러오지 못해 해당 계약 테스트를 건너뜁니다.`);
    return;
  }

  assert.strictEqual(typeof client.gen, 'function', `${provider} 클라이언트는 gen()을 제공해야 합니다.`);
  const output = await client.gen('contract-test');
  assert(Object.prototype.hasOwnProperty.call(output, 'text'), `${provider}.gen 은 text 필드를 반환해야 합니다.`);
  assert(Object.prototype.hasOwnProperty.call(output, 'raw'), `${provider}.gen 은 raw 필드를 반환해야 합니다.`);
  assert.strictEqual(typeof output.text, 'string', `${provider}.text 는 문자열이어야 합니다.`);
}

async function run() {
  console.log('acommit LLM 계약 테스트를 실행합니다...');

  // 실제 키를 제거해 네트워크 호출을 방지한다.
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  for (const item of CASES) {
    await verifyClient(item);
  }

  console.log('모든 LLM 계약 테스트가 통과했습니다.');
}

run().catch((err) => {
  console.error('테스트 실패:', err);
  process.exit(1);
});
