import React from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Toggle from './Toggle.jsx';
import Slider from './Slider.jsx';

export default function DiffSection({ cfg, onChange, t }) {
  const diff = cfg.diff ?? {};
  const set = (key, val) => onChange({ ...cfg, diff: { ...diff, [key]: val } });

  return (
    <Section title={t('diff')} desc={t('diffDesc')} defaultOpen={false}>
      <Field label={t('diffIncludeBinary')} id="diff.includeBinary" desc={t('diffIncludeBinaryDesc')} horizontal>
        <Toggle checked={diff.includeBinary ?? false} onChange={(v) => set('includeBinary', v)} />
      </Field>

      <Field label={t('diffSizeLimit')} id="diff.untrackedSizeLimit" desc={t('diffSizeLimitDesc')} horizontal>
        <Slider
          value={diff.untrackedSizeLimit ?? 512000}
          onChange={(v) => set('untrackedSizeLimit', v)}
          min={0}
          max={2000000}
          step={10000}
          unit="B"
        />
      </Field>
    </Section>
  );
}
