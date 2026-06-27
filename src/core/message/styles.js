/** Commit message style groups — tied to message.lang, not UI locale. */

export const MESSAGE_STYLES_BY_LANG = {
  ko: ['verb', 'declarative'],
  en: ['imperative', 'past'],
};

export const DEFAULT_MESSAGE_STYLE_BY_LANG = {
  ko: 'verb',
  en: 'imperative',
};

export function messageLangKey(lang) {
  return lang === 'en' ? 'en' : 'ko';
}

export function stylesForMessageLang(lang) {
  return MESSAGE_STYLES_BY_LANG[messageLangKey(lang)];
}

export function defaultStyleForMessageLang(lang) {
  return DEFAULT_MESSAGE_STYLE_BY_LANG[messageLangKey(lang)];
}

export function isStyleValidForMessageLang(style, lang) {
  return stylesForMessageLang(lang).includes(style);
}

export function coerceMessageStyle(style, lang) {
  return isStyleValidForMessageLang(style, lang)
    ? style
    : defaultStyleForMessageLang(lang);
}
