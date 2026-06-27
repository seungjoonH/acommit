import React, { useState, useEffect, useCallback } from 'react';
import { useT } from './i18n/index.js';
import TagsSection from './components/TagsSection.jsx';
import MessageSection from './components/MessageSection.jsx';
import ConventionalSection from './components/ConventionalSection.jsx';
import GroupingSection from './components/GroupingSection.jsx';
import LLMSection from './components/LLMSection.jsx';
import IgnoreSection from './components/IgnoreSection.jsx';
import DiffSection from './components/DiffSection.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import Toast from './components/Toast.jsx';
import UnsavedModal from './components/UnsavedModal.jsx';
import Icon from './components/Icon.jsx';
import { ensureMappedTagsInList } from './rules/syncTags.js';

const DEFAULTS = {
  tags: {
    enabled: true,
    list: ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf', 'build', 'ci'],
    style: '{tag}',
    separator: ': ',
    case: 'lower',
    bracket: 'none',
  },
  message: {
    lang: 'ko',
    style: 'verb',
    tone: 'concise',
    lines: 'single',
    wrap: 72,
    emoji: { enabled: false, map: {} },
  },
  grouping: {
    mode: 'by-similarity',
    directoryDepth: 1,
    minFilesPerGroup: 2,
    threshold: 0.6,
    maxGroupSize: 10,
  },
  conventional: { compatible: false, scope: { enabled: false, inferFromPath: true } },
  prompts: [],
  llm: { provider: 'gemini', model: 'gemini-2.5-flash', maxOutputTokens: 4000, maxPromptTokens: 200000 },
  ignore: {
    tagsForPaths: {
      'docs/**': 'docs',
      'scripts/**': 'chore',
      '**/package-lock.json': 'chore',
      '*.lock': 'chore',
      'pnpm-lock.yaml': 'chore',
      'yarn.lock': 'chore',
    },
  },
  diff: {
    includeBinary: false,
    untrackedSizeLimit: 512000,
    omitContent: ['**/package-lock.json', 'package-lock.json', '*.lock', 'pnpm-lock.yaml', 'yarn.lock'],
    skip: ['dist/**'],
  },
};

const layout = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'rgba(15,17,23,0.92)', backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border)',
    padding: '0 24px', height: '52px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: '15px', fontWeight: 700, color: 'var(--text)',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  titleDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  unsaved: { fontSize: '11px', color: 'var(--yellow)' },
  resetBtn: {
    padding: '6px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
  },
  saveBtn: (saving) => ({
    padding: '6px 18px', borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: saving ? 'var(--accent-dim)' : 'var(--accent)',
    color: saving ? 'var(--accent)' : '#fff',
    cursor: saving ? 'not-allowed' : 'pointer',
    fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
  }),
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '20px',
    padding: '20px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    alignItems: 'start',
  },
  settings: { display: 'flex', flexDirection: 'column', gap: '12px' },
};

export default function App() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [uiLocale, setUiLocale] = useState(null);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);

  const t = useT(uiLocale ?? 'en');

  useEffect(() => {
    Promise.all([
      fetch('/api/locale').then((r) => r.json()),
      fetch('/api/rules').then((r) => r.json()),
    ])
      .then(([localeData, data]) => {
        setUiLocale(localeData.locale === 'en' ? 'en' : 'ko');
        const base = { ...DEFAULTS, ...data };
        const next = ensureMappedTagsInList(base, base.ignore?.tagsForPaths);
        const listBefore = base.tags?.list ?? [];
        const listAfter = next.tags?.list ?? [];
        const tagsMerged = listAfter.length !== listBefore.length
          || listAfter.some((tag, i) => tag !== listBefore[i]);
        setCfg(next);
        setSaved(!tagsMerged);
      })
      .catch(() => {
        setUiLocale('en');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (uiLocale) {
      document.documentElement.lang = uiLocale;
    }
  }, [uiLocale]);

  const onChange = useCallback((next) => {
    setCfg(next);
    setSaved(false);
  }, []);

  const save = async () => {
    setSaving(true);
    const toSave = ensureMappedTagsInList(cfg, cfg.ignore?.tagsForPaths);
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) throw new Error(await res.text());
      setCfg(toSave);
      setSaved(true);
      setToast({ message: t('saved'), type: 'success' });
    } catch (err) {
      setToast({ message: `${t('saveError')}: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!saved) { setShowResetModal(true); return; }
    setCfg(DEFAULTS);
  };

  const confirmReset = () => {
    setCfg(DEFAULTS);
    setSaved(false);
    setShowResetModal(false);
  };

  if (loading || !uiLocale) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={layout.app}>
      <header style={layout.header}>
        <div style={layout.title}>
          <div style={layout.titleDot} />
          {t('title')}
        </div>
        <div style={layout.headerRight}>
          {!saved && <span style={layout.unsaved}><Icon name="dot" size={8} style={{ marginRight: '4px' }} />{t('unsaved')}</span>}
          <button className="header-btn-reset" style={layout.resetBtn} onClick={handleReset}>{t('reset')}</button>
          <button className="header-btn-save" style={layout.saveBtn(saving)} onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </header>

      <main style={layout.main}>
        <div style={layout.settings}>
          <TagsSection cfg={cfg} onChange={onChange} t={t} />
          <MessageSection cfg={cfg} onChange={onChange} t={t} />
          <ConventionalSection cfg={cfg} onChange={onChange} t={t} />
          <GroupingSection cfg={cfg} onChange={onChange} t={t} />
          <LLMSection cfg={cfg} onChange={onChange} t={t} />
          <IgnoreSection cfg={cfg} onChange={onChange} t={t} />
          <DiffSection cfg={cfg} onChange={onChange} t={t} />
        </div>

        <PreviewPanel cfg={cfg} t={t} />
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {showResetModal && (
        <UnsavedModal
          t={t}
          onConfirm={confirmReset}
          onCancel={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}
