import "dotenv/config";
import OpenAI from 'openai';
import logger from '../../utils/logger.js';

const DEFAULT_MODEL = 'gpt-4o';

export default function createOpenAIClient({ model: moduleModel } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    const suggestion = "Set your OpenAI credentials: export OPENAI_API_KEY=\"<key>\"; export OPENAI_MODEL=\"gpt-4o\"";
    logger.error(`OPENAI_API_KEY is not set. Add it to your .env or environment. ${suggestion}`, { exit: false });
    return { gen: async () => ({ text: '', raw: null }) };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  function pickModel(optsModel) {
    return optsModel || moduleModel || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  }

  async function gen(prompt, opts = {}) {
    const m = pickModel(opts.model);
    if (!m) {
      logger.error('OpenAI model selection failed; aborting request.', { exit: false });
      return { text: '', raw: null };
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
      logger.error(`OpenAI request failed: ${err?.message || String(err)}`, { exit: false });
      return { text: '', raw: { error: err?.message || String(err) } };
    }
  }

  return { gen };
}