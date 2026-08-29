import OpenAI from 'openai';
import { env } from '../../utils/env.js';
import logger from '../../utils/logger.js';

const BASE_URL = 'https://openrouter.ai/api/v1';

export default function createOpenRouterClient({ model: moduleModel, apiKey: suppliedApiKey } = {}) {
  const apiKey = suppliedApiKey || env('OPENROUTER_API_KEY');
  if (!apiKey) {
    const suggestion = 'Add OPENROUTER_API_KEY (or ACOMMIT_OPENROUTER_API_KEY) to your .env file.';
    logger.error(`OPENROUTER_API_KEY is not set. ${suggestion}`, { exit: false });
    return { gen: async () => ({ text: '', raw: null }) };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/seungjoonH/acommit',
      'X-Title': 'acommit',
    },
  });

  function pickModel(optsModel) {
    return optsModel || moduleModel || env('OPENROUTER_MODEL') || null;
  }

  async function gen(prompt, opts = {}) {
    const m = pickModel(opts.model);
    if (!m) {
      return { text: '', raw: { error: 'OpenRouter model selection failed; aborting request.' } };
    }

    const payload = {
      model: m,
      messages: [
        { role: 'system', content: opts.system || '' },
        { role: 'user', content: String(prompt || '') },
      ],
      max_tokens: opts.maxTokens || 1024,
    };
    if (opts.json) payload.response_format = { type: 'json_object' };
    if (Number.isFinite(opts.temperature)) payload.temperature = opts.temperature;

    try {
      const res = await client.chat.completions.create(payload);
      const text = res.choices?.[0]?.message?.content ?? '';
      return { text, raw: res };
    } catch (err) {
      return { text: '', raw: { error: err?.message || String(err) } };
    }
  }

  return { gen };
}
