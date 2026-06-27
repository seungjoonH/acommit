import React, { useState } from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Toggle from './Toggle.jsx';
import Segmented from './Segmented.jsx';
import ChipInput from './ChipInput.jsx';
import { describeTagExample } from '../preview/engine.js';

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '5px 9px',
  fontSize: '13px',
  fontFamily: 'monospace',
  width: '120px',
};

function TagPreviewPill({ cfg, t }) {
  const example = describeTagExample(cfg);
  if (!cfg.tags?.enabled) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 10px',
      background: 'var(--accent-dim)',
      borderRadius: '12px',
      fontSize: '12px',
      fontFamily: 'monospace',
      color: 'var(--accent)',
      border: '1px solid var(--accent)',
      flexShrink: 0,
    }}>
      {example}<span style={{ color: 'var(--text-muted)' }}>{t('tagsExampleSuffix')}</span>
    </span>
  );
}

const FALLBACK_TAG = 'feat';

const SEPARATOR_DEFAULT = ': ';

function separatorToInput(sep) {
  const v = sep ?? SEPARATOR_DEFAULT;
  if (v === ' ') return SEPARATOR_DEFAULT;
  return v;
}

export default function TagsSection({ cfg, onChange, t }) {
  const [advanced, setAdvanced] = useState(false);
  const tags = cfg.tags ?? {};

  const set = (key, val) => onChange({ ...cfg, tags: { ...tags, [key]: val } });

  const onListChange = (v) => {
    if (v.length === 0) {
      onChange({ ...cfg, tags: { ...tags, list: [], enabled: false } });
    } else {
      set('list', v);
    }
  };

  const onEnabledChange = (enabled) => {
    if (enabled && (tags.list ?? []).length === 0) {
      onChange({ ...cfg, tags: { ...tags, enabled: true, list: [FALLBACK_TAG] } });
    } else {
      set('enabled', enabled);
    }
  };

  const caseOptions = [
    { value: 'lower', label: t('caseLower') },
    { value: 'upper', label: t('caseUpper') },
    { value: 'capitalize', label: t('caseCapitalize') },
  ];
  const bracketOptions = [
    { value: 'none', label: t('bracketNone') },
    { value: 'square', label: t('bracketSquare') },
    { value: 'round', label: t('bracketRound') },
  ];

  // Derive style from builder (bracket=none → no colon; separator provides separation)
  const deriveStyle = (newCase, newBracket) => {
    const t_ = newCase === 'upper' ? '{TAG}' : newCase === 'capitalize' ? '{Tag}' : '{tag}';
    if (newBracket === 'square') return `[${t_}]`;
    if (newBracket === 'round') return `(${t_})`;
    return t_;
  };

  const onCaseChange = (v) => {
    const newStyle = deriveStyle(v, tags.bracket ?? 'none');
    onChange({ ...cfg, tags: { ...tags, case: v, style: newStyle } });
  };

  const onBracketChange = (v) => {
    const newStyle = deriveStyle(tags.case ?? 'lower', v);
    onChange({ ...cfg, tags: { ...tags, bracket: v, style: newStyle } });
  };

  return (
    <Section
      title={t('tags')}
      desc={t('tagsDesc')}
      extra={<TagPreviewPill cfg={cfg} t={t} />}
    >
      <Field label={t('tagsEnabled')} id="tags.enabled" horizontal>
        <Toggle checked={tags.enabled ?? true} onChange={onEnabledChange} />
      </Field>

      {tags.enabled !== false && (
        <>
          <Field label={t('tagsList')} id="tags.list" desc={t('tagsListDesc')} horizontal={false}>
            <ChipInput
              values={tags.list ?? []}
              onChange={onListChange}
              placeholder="feat, fix, docs..."
            />
          </Field>

          <Field label={t('tagsStyle')} id="tags.style" desc={t('tagsStyleDesc')} horizontal={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Segmented
                options={[
                  { value: 'builder', label: t('tagsStyleBuilder') },
                  { value: 'advanced', label: t('tagsStyleAdvanced') },
                ]}
                value={advanced ? 'advanced' : 'builder'}
                onChange={(v) => setAdvanced(v === 'advanced')}
              />
            </div>

            {!advanced ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Field label={t('tagsCase')} id="tags.case" horizontal>
                  <Segmented options={caseOptions} value={tags.case ?? 'lower'} onChange={onCaseChange} />
                </Field>
                <Field label={t('tagsBracket')} id="tags.bracket" horizontal>
                  <Segmented options={bracketOptions} value={tags.bracket ?? 'none'} onChange={onBracketChange} />
                </Field>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('tagsStyleTemplateDesc')}</p>
                <input
                  style={{ ...inputStyle, width: '220px' }}
                  value={tags.style ?? '{tag}'}
                  onChange={(e) => set('style', e.target.value)}
                  placeholder="{tag}"
                />
              </div>
            )}

            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('tagsStylePreview')}:</span>
              <TagPreviewPill cfg={cfg} t={t} />
            </div>
          </Field>

          <Field label={t('tagsSeparator')} id="tags.separator" desc={t('tagsSeparatorDesc')} horizontal>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
              <input
                style={inputStyle}
                value={separatorToInput(tags.separator)}
                onChange={(e) => set('separator', e.target.value)}
                placeholder={SEPARATOR_DEFAULT}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {JSON.stringify(tags.separator ?? SEPARATOR_DEFAULT)}
              </span>
            </div>
          </Field>
        </>
      )}
    </Section>
  );
}
