import logger from '../../utils/logger.js';
import { createProviderClient } from './providers.js';

export async function createLLMClient(provider, opts = {}) {
  const p = (provider || '').toLowerCase();
  try {
    return await createProviderClient(p, opts);
    } catch (err) {
      logger.error(`Failed to load LLM provider module for '${provider}': ${err?.message || String(err)}`, { exit: false });
      return null;
    }
}

export default createLLMClient;
