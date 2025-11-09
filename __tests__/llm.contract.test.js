// Ensure each LLM client returns {text, raw} without hitting the network.
// jest.config.cjs maps provider modules to mocks under __mocks__.
const mod = await import('../src/core/llm/index.js');
const { createLLMClient } = mod;

describe('LLM client contract', () => {
  test('OpenAI client returns {text, raw}', async () => {
    const client = await createLLMClient('openai', { model: 'gpt-3.5-turbo' });
    expect(client).toBeTruthy();
    expect(typeof client.gen).toBe('function');
    const out = await client.gen('hello');
    expect(out).toHaveProperty('text');
    expect(out).toHaveProperty('raw');
    expect(typeof out.text).toBe('string');
  });

  test('Gemini client also returns {text, raw}', async () => {
    const client = await createLLMClient('gemini');
    expect(client).toBeTruthy();
    expect(typeof client.gen).toBe('function');
    const out = await client.gen('hello');
    expect(out).toHaveProperty('text');
    expect(out).toHaveProperty('raw');
    expect(typeof out.text).toBe('string');
  });
});
