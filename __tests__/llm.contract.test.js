// ESM 환경에서 LLM 클라이언트가 {text, raw} 형태를 지키는지 검증한다.
// jest.config.cjs 의 moduleNameMapper 가 SDK를 로컬 mock 으로 연결하므로 네트워크 호출이 없다.
const mod = await import('../src/core/llm/index.js');
const { createLLMClient } = mod;

describe('LLM 클라이언트 계약', () => {
  test('OpenAI 클라이언트는 {text, raw}를 반환한다', async () => {
    const client = await createLLMClient('openai', { model: 'gpt-3.5-turbo' });
    expect(client).toBeTruthy();
    expect(typeof client.gen).toBe('function');
    const out = await client.gen('hello');
    expect(out).toHaveProperty('text');
    expect(out).toHaveProperty('raw');
    expect(typeof out.text).toBe('string');
  });

  test('Gemini 클라이언트도 {text, raw}를 반환한다', async () => {
    const client = await createLLMClient('gemini');
    expect(client).toBeTruthy();
    expect(typeof client.gen).toBe('function');
    const out = await client.gen('hello');
    expect(out).toHaveProperty('text');
    expect(out).toHaveProperty('raw');
    expect(typeof out.text).toBe('string');
  });
});
