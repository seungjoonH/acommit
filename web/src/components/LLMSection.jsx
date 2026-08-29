import React from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Slider from './Slider.jsx';

export default function LLMSection({ cfg, onChange, t }) {
  const llm = cfg.llm ?? {};
  const update = (patch) => onChange({ ...cfg, llm: { ...llm, ...patch } });
  return (
    <Section title={t('llm')} desc={t('llmDesc')}>
      <Field label={t('llmMaxOutput')} id="llm.maxOutputTokens" desc={t('llmMaxOutputDesc')} horizontal>
        <Slider value={llm.maxOutputTokens ?? 4000} onChange={(value) => update({ maxOutputTokens: value })} min={500} max={16000} step={500} unit="tok" />
      </Field>
      <Field label={t('llmMaxPrompt')} id="llm.maxPromptTokens" desc={t('llmMaxPromptDesc')} horizontal>
        <Slider value={llm.maxPromptTokens ?? 200000} onChange={(value) => update({ maxPromptTokens: value })} min={10000} max={1000000} step={10000} unit="tok" />
      </Field>
    </Section>
  );
}
