import React from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Toggle from './Toggle.jsx';

export default function ConventionalSection({ cfg, onChange, t }) {
  const conv = cfg.conventional ?? {};
  const scope = conv.scope ?? {};

  const setConv = (key, val) => onChange({ ...cfg, conventional: { ...conv, [key]: val } });
  const setScope = (key, val) => setConv('scope', { ...scope, [key]: val });

  return (
    <Section title={t('conventional')} desc={t('conventionalDesc')}>
      <Field label={t('conventionalCompatible')} id="conventional.compatible" horizontal>
        <Toggle checked={conv.compatible ?? false} onChange={(v) => setConv('compatible', v)} />
      </Field>

      {conv.compatible && (
        <>
          <Field label={t('conventionalScope')} id="conventional.scope.enabled" desc={t('conventionalScopeDesc')} horizontal>
            <Toggle checked={scope.enabled ?? false} onChange={(v) => setScope('enabled', v)} />
          </Field>

          {scope.enabled && (
            <Field label={t('conventionalInferFromPath')} id="conventional.scope.inferFromPath" desc={t('conventionalInferDesc')} horizontal>
              <Toggle checked={scope.inferFromPath ?? true} onChange={(v) => setScope('inferFromPath', v)} />
            </Field>
          )}
        </>
      )}
    </Section>
  );
}
