import logger from '../../utils/logger.js';

export async function createLLMClient(provider, opts = {}) {
  const p = (provider || '').toLowerCase();
  try {
    switch (p) {
      case 'gemini': {
        const mod = await import('./gemini.js');
        const createGemini = mod.default || mod.createGemini;
        return createGemini(opts);
      }
      case 'openai': {
        const mod = await import('./openai.js');
        const createOpenAI = mod.default || mod.createOpenAI;
        return createOpenAI(opts);
      }
      default:
          logger.error(`unknown llm provider: ${provider}`, { exit: false });
          return null;
    }
    } catch (err) {
      logger.error(`Failed to load LLM provider module for '${provider}': ${err?.message || String(err)}`, { exit: false });
      return null;
    }
}

export default createLLMClient;