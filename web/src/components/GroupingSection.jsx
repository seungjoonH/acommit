import React from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Slider from './Slider.jsx';
import Icon from './Icon.jsx';

function MiniViz({ mode }) {
  const s = {
    box: (color) => ({
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '28px', height: '20px', borderRadius: '3px',
      fontSize: '8px', fontWeight: 700, color: '#fff',
      background: color, flexShrink: 0,
    }),
    commit: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: 700,
      color: '#fff', background: '#6c63ff', flexShrink: 0,
    },
    arrow: { fontSize: '10px', color: 'var(--text-dim)', margin: '0 3px' },
    row: { display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap' },
    col: { display: 'flex', flexDirection: 'column', gap: '4px' },
    bracket: {
      borderLeft: '2px solid var(--border)', borderBottom: '2px solid var(--border)',
      width: '10px', height: '10px', flexShrink: 0,
    },
  };

  if (mode === 'per-file') return (
    <div style={s.col}>
      {[['#4a90d9','A'],['#5cb85c','B'],['#e67e22','C']].map(([c,l]) => (
        <div key={l} style={s.row}>
          <span style={s.box(c)}>{l}</span>
          <span style={s.arrow}>→</span>
          <span style={s.commit}>commit</span>
        </div>
      ))}
    </div>
  );

  if (mode === 'by-tag') return (
    <div style={s.col}>
      <div style={s.row}>
        <span style={s.box('#6c63ff')}>feat</span>
        <span style={s.box('#6c63ff')}>feat</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
      <div style={s.row}>
        <span style={s.box('#e74c3c')}>fix</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
    </div>
  );

  if (mode === 'by-directory') return (
    <div style={s.col}>
      <div style={s.row}>
        <span style={{ ...s.box('#2ecc71'), width: '44px' }}>src/</span>
        <span style={s.box('#2ecc71')}>A</span>
        <span style={s.box('#2ecc71')}>B</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
      <div style={s.row}>
        <span style={{ ...s.box('#e67e22'), width: '44px' }}>test/</span>
        <span style={s.box('#e67e22')}>C</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
    </div>
  );

  if (mode === 'by-similarity') return (
    <div style={s.col}>
      <div style={s.row}>
        <span style={s.box('#9b59b6')}>A</span>
        <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>~</span>
        <span style={s.box('#9b59b6')}>B</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
      <div style={s.row}>
        <span style={s.box('#16a085')}>C</span>
        <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>~</span>
        <span style={s.box('#16a085')}>D</span>
        <span style={s.arrow}>→</span>
        <span style={s.commit}>1 commit</span>
      </div>
    </div>
  );

  // none
  return (
    <div style={s.row}>
      {['A','B','C'].map((l) => <span key={l} style={s.box('#555')}>{l}</span>)}
      <span style={s.arrow}>→</span>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>msgs only</span>
    </div>
  );
}

const MODES = [
  { value: 'per-file',      icon: 'file',    labelKey: 'groupingModePerFile',      descKey: 'groupingModePerFileDesc' },
  { value: 'by-tag',        icon: 'tag',     labelKey: 'groupingModeByTag',        descKey: 'groupingModeByTagDesc' },
  { value: 'by-directory',  icon: 'folder',  labelKey: 'groupingModeByDirectory',  descKey: 'groupingModeByDirectoryDesc' },
  { value: 'by-similarity', icon: 'link',    labelKey: 'groupingModeBySimilarity', descKey: 'groupingModeBySimilarityDesc' },
  { value: 'none',          icon: 'message', labelKey: 'groupingModeNone',         descKey: 'groupingModeNoneDesc' },
];

export default function GroupingSection({ cfg, onChange, t }) {
  const g = cfg.grouping ?? {};
  const set = (key, val) => onChange({ ...cfg, grouping: { ...g, [key]: val } });
  const mode = g.mode ?? 'per-file';

  return (
    <Section title={t('grouping')} desc={t('groupingDesc')}>
      {/* Mode cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <div
              key={m.value}
              onClick={() => set('mode', m.value)}
              className={`mode-card${active ? ' mode-card--active' : ''}`}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'var(--surface2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                gridColumn: m.value === 'none' ? 'span 2' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Icon name={m.icon} size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)' }}>
                  {t(m.labelKey)}
                </span>
                {active && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', color: 'var(--accent)',
                    background: 'var(--accent-dim)', borderRadius: '4px', padding: '1px 6px',
                  }}>{t('groupingSelected')}</span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                {t(m.descKey)}
              </p>
              <div style={{ marginTop: '4px' }}>
                <MiniViz mode={m.value} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Conditional options */}
      {mode === 'by-directory' && (
        <Field label={t('groupingDirectoryDepth')} id="grouping.directoryDepth" desc={t('groupingDirectoryDepthDesc')} horizontal>
          <Slider value={g.directoryDepth ?? 1} onChange={(v) => set('directoryDepth', v)} min={1} max={6} step={1} />
        </Field>
      )}

      {(mode === 'by-tag' || mode === 'by-directory' || mode === 'by-similarity') && (
        <Field label={t('groupingMinFiles')} id="grouping.minFilesPerGroup" desc={t('groupingMinFilesDesc')} horizontal>
          <Slider value={g.minFilesPerGroup ?? 2} onChange={(v) => set('minFilesPerGroup', v)} min={1} max={10} step={1} />
        </Field>
      )}

      {mode === 'by-similarity' && (
        <Field label={t('groupingThreshold')} id="grouping.threshold" desc={t('groupingThresholdDesc')} horizontal>
          <Slider value={g.threshold ?? 0.6} onChange={(v) => set('threshold', v)} min={0} max={1} step={0.05} />
        </Field>
      )}
    </Section>
  );
}
