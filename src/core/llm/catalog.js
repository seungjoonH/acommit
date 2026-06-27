/** LLM route × vendor × model — CLI·rules UI·런타임 공통 카탈로그 */

export const CUSTOM_OPTION = '__custom__';

export const ROUTES = {
  direct: {
    label: 'Direct API',
  },
  openrouter: {
    label: 'OpenRouter',
  },
};

export const VENDORS = {
  direct: {
    gemini: {
      label: 'Gemini',
      hint: 'Google AI Studio',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
      default: 'gemini-2.5-flash',
    },
    openai: {
      label: 'OpenAI',
      hint: 'OpenAI API',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      default: 'gpt-4o-mini',
    },
  },
  openrouter: {
    google: {
      label: 'Google (Gemini)',
      hint: 'google/*',
      models: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro'],
      default: 'google/gemini-2.5-flash',
    },
    openai: {
      label: 'OpenAI',
      hint: 'openai/*',
      models: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
      default: 'openai/gpt-4o-mini',
    },
    anthropic: {
      label: 'Anthropic (Claude)',
      hint: 'anthropic/*',
      models: ['anthropic/claude-haiku-4.5', 'anthropic/claude-sonnet-4'],
      default: 'anthropic/claude-haiku-4.5',
    },
  },
};

const RUNTIME_PROVIDERS = new Set(['gemini', 'openai', 'openrouter']);
const OPENROUTER_PREFIXES = {
  google: 'google/',
  openai: 'openai/',
  anthropic: 'anthropic/',
};

export function isRuntimeProvider(value) {
  return RUNTIME_PROVIDERS.has(String(value || '').toLowerCase());
}

export function inferOpenRouterVendor(model) {
  const m = String(model || '');
  if (m.startsWith('google/')) return 'google';
  if (m.startsWith('openai/')) return 'openai';
  if (m.startsWith('anthropic/')) return 'anthropic';
  if (m.startsWith('meta-llama/')) return 'meta';
  return 'google';
}

function findOpenRouterVendor(model) {
  const m = String(model || '');
  if (!m) return 'google';

  for (const [key, def] of Object.entries(VENDORS.openrouter)) {
    if (def.models.includes(m)) return key;
    const prefix = OPENROUTER_PREFIXES[key];
    if (prefix && m.startsWith(prefix)) return key;
  }
  return CUSTOM_OPTION;
}

function findDirectVendor(provider) {
  const p = String(provider || 'gemini').toLowerCase();
  if (p in VENDORS.direct) return p;
  if (p === 'openrouter') return 'gemini';
  return CUSTOM_OPTION;
}

/** rules.yml { provider, model } → wizard state */
export function parseLlmConfig({ provider, model } = {}) {
  const p = String(provider || 'gemini').toLowerCase();
  const m = String(model || '');

  if (p === 'openrouter') {
    const vendor = findOpenRouterVendor(m);
    const customVendor = vendor === CUSTOM_OPTION && m.includes('/')
      ? m.split('/')[0]
      : vendor === CUSTOM_OPTION && m
        ? m
        : undefined;
    return {
      route: 'openrouter',
      vendor,
      model: m || VENDORS.openrouter.google.default,
      customVendor,
    };
  }

  const vendor = p === 'openai' ? 'openai' : findDirectVendor(p);
  const customVendor = vendor === CUSTOM_OPTION ? p : undefined;
  const vendorKey = vendor === CUSTOM_OPTION ? 'gemini' : vendor;
  return {
    route: 'direct',
    vendor,
    model: m || VENDORS.direct[vendorKey]?.default || VENDORS.direct.gemini.default,
    customVendor,
  };
}

/** wizard state → rules.yml { provider, model } */
export function resolveLlmConfig({ route, vendor, model, customVendor } = {}) {
  const actualVendor = vendor === CUSTOM_OPTION
    ? String(customVendor || '').trim().toLowerCase()
    : vendor;

  if (route === 'openrouter') {
    const vendorDef = actualVendor && actualVendor !== CUSTOM_OPTION
      ? VENDORS.openrouter[actualVendor]
      : null;
    const resolvedModel = String(model || '').trim()
      || vendorDef?.default
      || '';
    return { provider: 'openrouter', model: resolvedModel };
  }

  const vendorDef = VENDORS.direct[actualVendor];
  const resolvedModel = String(model || '').trim()
    || vendorDef?.default
    || '';
  return { provider: actualVendor, model: resolvedModel };
}

export function apiKeyHint({ provider } = {}) {
  const p = String(provider || '').toLowerCase();
  if (p === 'openrouter') return 'Set OPENROUTER_API_KEY and optionally OPENROUTER_MODEL.';
  if (p === 'openai') return 'Set OPENAI_API_KEY and optionally OPENAI_MODEL.';
  return 'Set GEMINI_API_KEY and optionally GEMINI_MODEL.';
}

export function vendorOptions(route, { customLabel = 'Custom…' } = {}) {
  const vendors = VENDORS[route] || {};
  return [
    ...Object.entries(vendors).map(([value, def]) => ({
      value,
      label: def.label,
      hint: def.hint,
    })),
    { value: CUSTOM_OPTION, label: customLabel, hint: 'type your own' },
  ];
}

export function modelOptions(route, vendor, { customLabel = 'Custom…' } = {}) {
  if (vendor === CUSTOM_OPTION) {
    return [{ value: CUSTOM_OPTION, label: customLabel, hint: 'type your own' }];
  }
  const vendorDef = VENDORS[route]?.[vendor];
  if (!vendorDef) {
    return [{ value: CUSTOM_OPTION, label: customLabel, hint: 'type your own' }];
  }
  return [
    ...vendorDef.models.map((m) => ({
      value: m,
      label: m,
      hint: m === vendorDef.default ? 'default' : undefined,
    })),
    { value: CUSTOM_OPTION, label: customLabel, hint: 'type your own' },
  ];
}

export function catalogForApi() {
  return {
    customOption: CUSTOM_OPTION,
    routes: ROUTES,
    vendors: VENDORS,
  };
}
