/** Tag prefix rendering — shared by schema, preview, and prompts. */

export function deriveStyleFromCaseBracket(case_ = 'lower', bracket = 'none') {
  const t = case_ === 'upper' ? '{TAG}' : case_ === 'capitalize' ? '{Tag}' : '{tag}';
  if (bracket === 'square') return `[${t}]`;
  if (bracket === 'round') return `(${t})`;
  return t;
}

export function createTagRenderer(tags = {}) {
  if (tags.enabled === false) return () => '';
  const styleStr = (tags.style ?? '').trim();
  const sep = tags.separator ?? ': ';

  if (styleStr) {
    return (tag, scope = '') => {
      const s = effectiveScope(tag, scope);
      return styleStr
        .replace(/\{tag\}/g, tag.toLowerCase())
        .replace(/\{TAG\}/g, tag.toUpperCase())
        .replace(/\{Tag\}/g, tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase())
        .replace(/\{scope\}/g, s)
        .replace(/\{sep\}/g, sep)
        .replace(/\(\)/g, '');
    };
  }

  const toCase = (t) => {
    if (tags.case === 'upper') return t.toUpperCase();
    if (tags.case === 'capitalize') return t.charAt(0).toUpperCase() + t.slice(1);
    return t.toLowerCase();
  };
  const wrapBracket = (t) => {
    if (tags.bracket === 'square') return `[${t}]`;
    if (tags.bracket === 'round') return `(${t})`;
    return t;
  };
  return (tag) => wrapBracket(toCase(tag));
}

export function inferScope(filePath) {
  const parts = String(filePath || '').replace(/^src\//, '').split('/');
  return parts.length > 1 ? parts[0] : '';
}

export function effectiveScope(tag, scope) {
  const s = String(scope || '').trim();
  if (!s || s === tag) return '';
  return s;
}

/** Append separator once — avoids `feat::` when render already ends with `:`. */
export function appendSeparator(rendered, sep = ': ') {
  if (!sep) return rendered;
  let base = String(rendered);
  if (base.endsWith(sep)) return base;
  if (sep.startsWith(':') && /:$/.test(base)) {
    return base + sep.slice(1);
  }
  return base + sep;
}

export function buildTagPrefix(cfg, tag, file = '', { render: renderFn } = {}) {
  const tags = cfg.tags ?? {};
  if (tags.enabled === false) return '';
  const render = renderFn ?? tags.render ?? createTagRenderer(tags);
  const sep = tags.separator ?? ': ';

  let scope = '';
  if (cfg.conventional?.compatible && cfg.conventional?.scope?.enabled) {
    if (cfg.conventional?.scope?.inferFromPath && file) {
      scope = effectiveScope(tag, inferScope(file));
    }
    const styleStr = (tags.style ?? '').trim();
    if (styleStr && styleStr.includes('{scope}')) {
      return appendSeparator(render(tag, scope), sep);
    }
    const base = String(render(tag)).replace(/:+$/, '');
    return appendSeparator(scope ? `${base}(${scope})` : base, sep);
  }

  return appendSeparator(render(tag), sep);
}

export function describeTagExample(cfg, samplePath = 'src/auth/login.js') {
  if (cfg.tags?.enabled === false) return '(tags disabled)';
  const tag = cfg.tags?.list?.[0] ?? 'feat';
  return buildTagPrefix(cfg, tag, samplePath);
}

export function resolveCommitTag(cfg, tag) {
  const list = cfg.tags?.list ?? [];
  if (list.includes(tag)) return tag;
  return tag;
}
