import OpenAI from 'openai';
import { env } from '../../utils/env.js';
import logger from '../../utils/logger.js';

export default function createOpenAIClient({ model: moduleModel, apiKey: suppliedApiKey } = {}) {
  const apiKey = suppliedApiKey || env('OPENAI_API_KEY');
  if (!apiKey) {
    const suggestion = 'Add OPENAI_API_KEY or ACOMMIT_OPENAI_API_KEY to your .env file.';
    logger.error(`OPENAI_API_KEY is not set. ${suggestion}`, { exit: false });
    return { gen: async () => ({ text: '', raw: null }) };
  }

  const client = new OpenAI({ apiKey });

  function pickModel(optsModel) {
    return optsModel || moduleModel || env('OPENAI_MODEL') || null;
  }

  async function gen(prompt, opts = {}) {
    const m = pickModel(opts.model);
    if (!m) {
      return { text: '', raw: { error: 'OpenAI model selection failed; aborting request.' } };
    }
    const payload = {
      model: m,
      messages: [
        { role: 'system', content: opts.system || '' },
        { role: 'user', content: String(prompt || '') }
      ],
      max_tokens: opts.maxTokens || 1024
    };

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
