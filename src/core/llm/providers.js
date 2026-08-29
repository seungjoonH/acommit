export const PROVIDERS = Object.freeze({
  gemini: Object.freeze({
    id: 'gemini', label: 'Gemini', keyName: 'GEMINI_API_KEY', modelName: 'GEMINI_MODEL',
    async listModels(key, fetchImpl = fetch) {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`Gemini model lookup failed (${res.status})`);
      const json = await res.json();
      return (json.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => String(m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
    },
  }),
  openai: Object.freeze({
    id: 'openai', label: 'OpenAI', keyName: 'OPENAI_API_KEY', modelName: 'OPENAI_MODEL',
    async listModels(key, fetchImpl = fetch) {
      const res = await fetchImpl('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error(`OpenAI model lookup failed (${res.status})`);
      const json = await res.json();
      return (json.data || []).map((m) => m.id).filter(Boolean).sort();
    },
  }),
  openrouter: Object.freeze({
    id: 'openrouter', label: 'OpenRouter', keyName: 'OPENROUTER_API_KEY', modelName: 'OPENROUTER_MODEL',
    async listModels(key, fetchImpl = fetch) {
      const res = await fetchImpl('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error(`OpenRouter model lookup failed (${res.status})`);
      const json = await res.json();
      return (json.data || []).map((m) => m.id).filter(Boolean).sort();
    },
  }),
});

export function providerDefinition(id) {
  return PROVIDERS[String(id || '').toLowerCase()] || null;
}

export async function createProviderClient(provider, options = {}) {
  const def = providerDefinition(provider);
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  const modulePath = `./${def.id}.js`;
  const mod = await import(modulePath);
  const factory = mod.default;
  if (typeof factory !== 'function') throw new Error(`Provider '${def.id}' has no client factory`);
  return factory(options);
}

export async function listProviderModels(provider, key, { fetchImpl = fetch } = {}) {
  const def = providerDefinition(provider);
  if (!def) throw new Error(`Unknown provider: ${provider}`);
  if (!key) throw new Error(`${def.keyName} is not configured`);
  return def.listModels(key, fetchImpl);
}
