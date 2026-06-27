import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  CUSTOM_OPTION,
  ROUTES,
  VENDORS,
  parseLlmConfig,
  resolveLlmConfig,
  vendorOptions,
  apiKeyHint,
} from '@acommit/core/llm/catalog.js';
import Section from './Section.jsx';
import Field from './Field.jsx';
import Segmented from './Segmented.jsx';
import Slider from './Slider.jsx';
import Icon from './Icon.jsx';
import Combobox from './Combobox.jsx';

const PRICE = {
  'gemini-2.5-flash':              [0.30,  2.50],
  'gemini-2.5-pro':                [1.25, 10.00],
  'gemini-2.0-flash':              [0.10,  0.40],
  'gemini-1.5-pro':                [1.25,  5.00],
  'gpt-4o-mini':                   [0.15,  0.60],
  'gpt-4o':                        [2.50, 10.00],
  'gpt-4-turbo':                   [10.0, 30.00],
  'gpt-3.5-turbo':                 [0.50,  1.50],
  'google/gemini-2.5-flash':       [0.30,  2.50],
  'anthropic/claude-haiku-4.5':    [0.80,  4.00],
  'openai/gpt-4o-mini':            [0.15,  0.60],
  'meta-llama/llama-3.3-70b-instruct': [0.07, 0.07],
};

const BASE_INPUT  = 5_000;
const BASE_OUTPUT = 300;

function estimateCost(model, maxPrompt, maxOutput) {
  const p = PRICE[model];
  if (!p) return null;
  const [inP, outP] = p;
  const effIn  = Math.min(maxPrompt, Math.max(BASE_INPUT, maxPrompt * 0.025));
  const effOut = Math.min(maxOutput, Math.max(BASE_OUTPUT, maxOutput * 0.075));
  const perCommit  = (effIn * inP + effOut * outP) / 1_000_000;
  const worstCase  = (maxPrompt * inP + maxOutput * outP) / 1_000_000;
  return { perCommit, worstCase, effIn, effOut, inP, outP };
}

function PriceTag({ model, maxPrompt, maxOutput, t }) {
  const est = estimateCost(model, maxPrompt, maxOutput);
  if (!est) return null;

  const fmt = (n) => n < 0.00005 ? '< $0.0001' : `$${n.toFixed(4)}`;
  const commitsPerDollar = est.perCommit > 0 ? Math.round(1 / est.perCommit) : 0;

  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {t('llmCostTitle')}
      </div>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', lineHeight: 1 }}>
            {fmt(est.perCommit)}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('llmCostPerCommit')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)', fontFamily: 'monospace', lineHeight: 1 }}>
            ~{commitsPerDollar.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('llmCostPerDollar')}</span>
        </div>
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
        {t('llmCostDisclaimer')}
      </div>
    </div>
  );
}

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '5px 9px',
  fontSize: '13px',
  width: '240px',
};

function modelChoices(route, vendor) {
  if (vendor === CUSTOM_OPTION) return [];
  return VENDORS[route]?.[vendor]?.models ?? [];
}

function defaultModel(route, vendor) {
  if (vendor === CUSTOM_OPTION) return '';
  return VENDORS[route]?.[vendor]?.default ?? '';
}

export default function LLMSection({ cfg, onChange, t }) {
  const llm = cfg.llm ?? {};
  const base = useMemo(() => parseLlmConfig(llm), [llm.provider, llm.model]);
  const ownUpdate = useRef(false);
  const [vendorDraft, setVendorDraft] = useState(null);

  useEffect(() => {
    if (ownUpdate.current) {
      ownUpdate.current = false;
      return;
    }
    const parsed = parseLlmConfig(llm);
    setVendorDraft(
      parsed.vendor === CUSTOM_OPTION
        ? { vendor: CUSTOM_OPTION, customVendor: parsed.customVendor ?? '' }
        : null,
    );
  }, [llm.provider, llm.model]);

  const wizard = vendorDraft ? { ...base, ...vendorDraft } : base;
  const resolved = useMemo(
    () => resolveLlmConfig(wizard),
    [wizard.route, wizard.vendor, wizard.model, wizard.customVendor],
  );

  const setLlm = (nextLlm) => {
    ownUpdate.current = true;
    onChange({ ...cfg, llm: { ...llm, ...nextLlm } });
  };

  const applyWizard = (patch) => {
    const next = { ...wizard, ...patch };
    if (next.vendor === CUSTOM_OPTION) {
      setVendorDraft({
        vendor: CUSTOM_OPTION,
        customVendor: next.customVendor ?? '',
      });
    } else {
      setVendorDraft(null);
    }
    setLlm(resolveLlmConfig(next));
  };

  const routeOptions = Object.entries(ROUTES).map(([value, def]) => ({
    value,
    label: def.label,
  }));

  const vendors = vendorOptions(wizard.route, { customLabel: t('llmCustom') });
  const models = modelChoices(wizard.route, wizard.vendor);

  const onRouteChange = (route) => {
    setVendorDraft(null);
    const firstVendor = Object.keys(VENDORS[route])[0];
    applyWizard({
      route,
      vendor: firstVendor,
      model: defaultModel(route, firstVendor),
      customVendor: undefined,
    });
  };

  const onVendorChange = (vendor) => {
    if (vendor === CUSTOM_OPTION) {
      setVendorDraft({
        vendor: CUSTOM_OPTION,
        customVendor: wizard.customVendor ?? '',
      });
      return;
    }
    applyWizard({
      vendor,
      customVendor: undefined,
      model: defaultModel(wizard.route, vendor),
    });
  };

  const onCustomVendorChange = (customVendor) => {
    applyWizard({ vendor: CUSTOM_OPTION, customVendor });
  };

  const onModelChange = (model) => {
    applyWizard({ model });
  };

  const apiHint = apiKeyHint(resolved);
  const customVendorPlaceholder = wizard.route === 'openrouter'
    ? t('llmCustomVendorOpenRouterPlaceholder')
    : t('llmCustomVendorDirectPlaceholder');
  const modelPlaceholder = wizard.route === 'openrouter'
    ? (wizard.customVendor ? `${wizard.customVendor}/model-id` : 'vendor/model-id')
    : t('llmModelPlaceholder');

  return (
    <Section title={t('llm')} desc={t('llmDesc')}>
      <Field label={t('llmConnection')} id="llm.connection" desc="route" horizontal>
        <Segmented options={routeOptions} value={wizard.route} onChange={onRouteChange} />
      </Field>

      <Field
        label={wizard.route === 'openrouter' ? t('llmVendorOpenRouter') : t('llmVendorDirect')}
        id="llm.vendor"
        desc="vendor"
        horizontal
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
          <Segmented options={vendors} value={wizard.vendor} onChange={onVendorChange} />
          {wizard.vendor === CUSTOM_OPTION && (
            <input
              style={inputStyle}
              value={wizard.customVendor ?? ''}
              onChange={(e) => onCustomVendorChange(e.target.value)}
              placeholder={customVendorPlaceholder}
            />
          )}
        </div>
      </Field>

      <Field label={t('llmModel')} id="llm.model" desc="llm.model" horizontal>
        <Combobox
          value={wizard.model}
          onChange={onModelChange}
          options={models}
          placeholder={modelPlaceholder}
        />
      </Field>

      <PriceTag
        model={wizard.model}
        maxPrompt={llm.maxPromptTokens ?? 200000}
        maxOutput={llm.maxOutputTokens ?? 4000}
        t={t}
      />

      <Field label={t('llmMaxOutput')} id="llm.maxOutputTokens" desc={t('llmMaxOutputDesc')} horizontal>
        <Slider value={llm.maxOutputTokens ?? 4000} onChange={(v) => setLlm({ maxOutputTokens: v })} min={500} max={16000} step={500} unit="tok" />
      </Field>

      <Field label={t('llmMaxPrompt')} id="llm.maxPromptTokens" desc={t('llmMaxPromptDesc')} horizontal>
        <Slider value={llm.maxPromptTokens ?? 200000} onChange={(v) => setLlm({ maxPromptTokens: v })} min={10000} max={1000000} step={10000} unit="tok" />
      </Field>

      <div style={{
        background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: '3px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Icon name="warning" size={13} style={{ color: 'var(--yellow)' }} />{t('llmApiKeyNote')}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {resolved.provider} → {apiHint}
        </span>
      </div>
    </Section>
  );
}
