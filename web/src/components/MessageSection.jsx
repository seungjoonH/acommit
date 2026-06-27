import React from 'react';
import EmojiPickerCustom from './EmojiPickerCustom.jsx';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Toggle from './Toggle.jsx';
import Segmented from './Segmented.jsx';
import Slider from './Slider.jsx';

const DEFAULT_EMOJI_MAP = {
  feat: '✨', fix: '🐛', docs: '📝', chore: '🔧',
  refactor: '♻️', test: '✅', perf: '⚡', build: '📦', ci: '👷',
};

const STYLE_KEYS_BY_LANG = {
  ko: ['verb', 'declarative'],
  en: ['imperative', 'past'],
};

const DEFAULT_STYLE_BY_LANG = {
  ko: 'verb',
  en: 'imperative',
};

function styleKeysForLang(lang) {
  return STYLE_KEYS_BY_LANG[lang === 'en' ? 'en' : 'ko'];
}

function defaultStyleForLang(lang) {
  return DEFAULT_STYLE_BY_LANG[lang === 'en' ? 'en' : 'ko'];
}

export default function MessageSection({ cfg, onChange, t }) {
  const msg = cfg.message ?? {};
  const lang = msg.lang ?? 'ko';
  const set = (key, val) => onChange({ ...cfg, message: { ...msg, [key]: val } });

  const langOptions = [
    { value: 'ko', label: t('messageLangKo') },
    { value: 'en', label: t('messageLangEn') },
  ];

  const allStyleOptions = [
    { value: 'verb',        label: t('messageStyleVerb'),        desc: t('messageStyleVerbDesc') },
    { value: 'declarative', label: t('messageStyleDeclarative'), desc: t('messageStyleDeclarativeDesc') },
    { value: 'imperative',  label: t('messageStyleImperative'),  desc: t('messageStyleImperativeDesc') },
    { value: 'past',        label: t('messageStylePast'),        desc: t('messageStylePastDesc') },
  ];
  const allowed = new Set(styleKeysForLang(lang));
  const styleOptions = allStyleOptions.filter((o) => allowed.has(o.value));
  const styleValue = allowed.has(msg.style) ? msg.style : defaultStyleForLang(lang);

  const toneOptions = [
    { value: 'concise',  label: t('messageToneConcise'),  desc: t('messageToneConciseDesc') },
    { value: 'detailed', label: t('messageToneDetailed'), desc: t('messageToneDetailedDesc') },
  ];
  const linesOptions = [
    { value: 'single', label: t('messageLinesSingle') },
    { value: 'multi',  label: t('messageLinesMulti') },
  ];

  const tagList = cfg.tags?.list ?? Object.keys(DEFAULT_EMOJI_MAP);
  const emojiMap = { ...DEFAULT_EMOJI_MAP, ...(msg.emoji?.map ?? {}) };

  const onEmojiChange = (tag, emoji) => {
    set('emoji', { ...(msg.emoji ?? {}), map: { ...emojiMap, [tag]: emoji } });
  };

  const onLangChange = (nextLang) => {
    const nextAllowed = new Set(styleKeysForLang(nextLang));
    const nextStyle = nextAllowed.has(msg.style) ? msg.style : defaultStyleForLang(nextLang);
    onChange({ ...cfg, message: { ...msg, lang: nextLang, style: nextStyle } });
  };

  const currentStyleDesc = styleOptions.find((o) => o.value === styleValue)?.desc;
  const currentToneDesc  = toneOptions.find(o => o.value === (msg.tone ?? 'concise'))?.desc;

  return (
    <Section title={t('message')} desc={t('messageDesc')}>
      <Field label={t('messageLang')} id="message.lang" horizontal>
        <Segmented options={langOptions} value={lang} onChange={onLangChange} />
      </Field>

      <Field label={t('messageStyle')} id="message.style" desc={currentStyleDesc} horizontal>
        <Segmented options={styleOptions} value={styleValue} onChange={(v) => set('style', v)} />
      </Field>

      <Field label={t('messageTone')} id="message.tone" desc={currentToneDesc} horizontal>
        <Segmented options={toneOptions} value={msg.tone ?? 'concise'} onChange={(v) => set('tone', v)} />
      </Field>

      <Field label={t('messageLines')} id="message.lines" desc={t('messageLinesDesc')} horizontal>
        <Segmented options={linesOptions} value={msg.lines ?? 'single'} onChange={(v) => set('lines', v)} />
      </Field>

      <Field label={t('messageWrap')} id="message.wrap" desc={t('messageWrapDesc')} horizontal>
        <Slider value={msg.wrap ?? 72} onChange={(v) => set('wrap', v)} min={0} max={120} step={1} unit={t('messageWrapUnit')} />
      </Field>

      <Field label={t('messageEmoji')} id="message.emoji.enabled" desc={t('messageEmojiDesc')} horizontal>
        <Toggle
          checked={msg.emoji?.enabled ?? false}
          onChange={(v) => set('emoji', { ...(msg.emoji ?? {}), enabled: v })}
          label={t('messageEmojiEnabled')}
        />
      </Field>

      {msg.emoji?.enabled && (
        <Field label={t('messageEmojiMap')} id="message.emoji.map" desc={t('messageEmojiMapDesc')} horizontal={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {tagList.map((tag) => (
              <EmojiPickerCustom
                key={tag}
                tag={tag}
                emoji={emojiMap[tag] ?? ''}
                onChange={onEmojiChange}
              />
            ))}
          </div>
        </Field>
      )}
    </Section>
  );
}
