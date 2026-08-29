import { PROVIDERS } from './providers.js';

export const CUSTOM_OPTION = '__custom__';
export const ROUTES = Object.freeze({ direct: { label: 'Direct API' }, openrouter: { label: 'OpenRouter' } });
export const VENDORS = Object.freeze({
  direct: Object.freeze({
    gemini: Object.freeze({ label: PROVIDERS.gemini.label, hint: 'Google AI Studio' }),
    openai: Object.freeze({ label: PROVIDERS.openai.label, hint: 'OpenAI API' }),
  }),
  openrouter: Object.freeze({
    openrouter: Object.freeze({ label: PROVIDERS.openrouter.label, hint: 'Any model available to this key' }),
  }),
});

export function isRuntimeProvider(value) { return Boolean(PROVIDERS[String(value || '').toLowerCase()]); }
export function inferOpenRouterVendor() { return 'openrouter'; }
export function parseLlmConfig({ provider, model } = {}) {
  const p = isRuntimeProvider(provider) ? String(provider).toLowerCase() : null;
  return { route: p === 'openrouter' ? 'openrouter' : 'direct', vendor: p === 'openrouter' ? 'openrouter' : p, model: String(model || '') };
}
export function resolveLlmConfig({ route, vendor, model } = {}) {
  return { provider: route === 'openrouter' ? 'openrouter' : vendor, model: String(model || '').trim() };
}
export function apiKeyHint({ provider } = {}) {
  const def = PROVIDERS[String(provider || '').toLowerCase()];
  return def ? `Set ACOMMIT_${def.keyName} (preferred) or ${def.keyName}.` : 'Select a supported provider.';
}
export function vendorOptions(route) {
  return Object.entries(VENDORS[route] || {}).map(([value, def]) => ({ value, label: def.label, hint: def.hint }));
}
export function modelOptions(models = [], { customLabel = 'Custom…' } = {}) {
  return [...models.map((model) => ({ value: model, label: model })), { value: CUSTOM_OPTION, label: customLabel, hint: 'type your own' }];
}
export function catalogForApi() {
  return { customOption: CUSTOM_OPTION, routes: ROUTES, vendors: VENDORS, models: 'dynamic' };
}
