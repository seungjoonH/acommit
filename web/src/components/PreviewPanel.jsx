import React, { useState } from 'react';
import { computeSingle, computeMulti, computeFileGroups, getEffectiveFiles, MULTI_FILES, SINGLE_FILE } from '../preview/engine.js';
import Icon from './Icon.jsx';

// Group palette — up to 6 distinct groups
const GROUP_COLORS = ['#6c63ff', '#e74c3c', '#2ecc71', '#f39c12', '#3498db', '#e67e22'];

const TAG_COLOR = {
  feat: '#6c63ff', fix: '#e74c3c', docs: '#3498db', chore: '#95a5a6',
  refactor: '#e67e22', test: '#27ae60', perf: '#f39c12', build: '#8e44ad', ci: '#16a085',
};

// ── Folder tree ───────────────────────────────────────────────
const TREE_STRUCTURE = {
  docs: ['docs/api.md'],
  src: {
    assets: ['src/assets/logo.png'],
    auth:   ['src/auth/login.js', 'src/auth/logout.js', 'src/auth/middleware.js'],
    utils:  ['src/utils/format.js', 'src/utils/counter.js'],
  },
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);

function fmt(template, vars) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

// state: 'normal' | 'dimmed' | 'ignored'
function FileRow({ path, tag, groupColor, state = 'normal', forcedTag, t }) {
  const name = path.split('/').pop();
  const ext  = '.' + (name.split('.').pop() ?? '');
  const isImg     = IMAGE_EXTS.has(ext.toLowerCase());
  const isIgnored = state === 'ignored';
  const isDimmed  = state === 'dimmed';
  const isForced  = !!forcedTag;
  const isBinaryEntry = MULTI_FILES.find(f => f.path === path)?.binary ?? false;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: isIgnored ? 0.3 : isDimmed ? 0.25 : 1, transition: 'opacity 0.2s' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'pre' }}>│   </span>
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-dim)' }}>├─</span>
      <Icon
        name={isImg ? 'image' : 'file'}
        size={11}
        style={{ color: isIgnored || isDimmed ? 'var(--text-dim)' : isImg ? '#f39c12' : 'var(--text-muted)', flexShrink: 0 }}
      />
      <span style={{
        fontSize: '11px', fontFamily: 'monospace', flex: 1,
        color: isIgnored || isDimmed ? 'var(--text-dim)' : 'var(--text)',
        textDecoration: isIgnored ? 'line-through' : 'none',
      }}>{name}</span>
      {isBinaryEntry && !isIgnored && !isDimmed && (
        <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>bin</span>
      )}
      {!isIgnored && !isDimmed && (
        <span style={{
          fontSize: '9px', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontWeight: 600,
          background: (TAG_COLOR[tag] ?? '#555') + '22',
          color: TAG_COLOR[tag] ?? '#aaa',
          border: `1px solid ${(TAG_COLOR[tag] ?? '#555')}44`,
          outline: isForced ? `1px solid ${TAG_COLOR[tag] ?? '#aaa'}` : 'none',
        }} title={isForced ? `${t('previewForcedTag')}: ${tag}` : undefined}>{tag}</span>
      )}
      {groupColor && !isIgnored && !isDimmed && (
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: groupColor, flexShrink: 0, boxShadow: `0 0 4px ${groupColor}88` }} />
      )}
    </div>
  );
}

function DirRow({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-dim)' }}>├─</span>
      <Icon name="folder" size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{name}/</span>
    </div>
  );
}

function FolderTree({ isSingle, groupMap, mode, effectiveFiles, singlePath, t }) {
  const showGroups = !isSingle && mode !== 'per-file' && mode !== 'none';

  // Build lookup: path → effective entry (with possibly overridden tag)
  const effectiveMap = new Map(effectiveFiles.map(e => [e.path, e]));
  // Build original tag map for detecting forced-tag overrides
  const origMap = new Map(MULTI_FILES.map(e => [e.path, e]));

  const renderPaths = (paths, indent = false) =>
    paths.map(path => {
      const effective = effectiveMap.get(path);
      const original  = origMap.get(path);
      const isIgnored = !effective;
      const tag = effective?.tag ?? original?.tag ?? '';
      const forcedTag = effective && original && effective.tag !== original.tag ? effective.tag : null;
      const gi = groupMap?.get(path);
      const groupColor = showGroups && gi !== undefined ? GROUP_COLORS[gi % GROUP_COLORS.length] : null;
      let state = 'normal';
      if (isIgnored) state = 'ignored';
      else if (isSingle && path !== singlePath) state = 'dimmed';
      return (
        <div key={path} style={indent ? { paddingLeft: '16px' } : {}}>
          <FileRow path={path} tag={tag} groupColor={groupColor} state={state} forcedTag={forcedTag} t={t} />
        </div>
      );
    });

  return (
    <div style={{
      background: '#0a0c14', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)', padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <Icon name="folder" size={12} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent)' }}>project/</span>
        {showGroups && (
          <span style={{ fontSize: '9px', color: 'var(--text-dim)', marginLeft: 'auto' }}>{t('previewSameColorLegend')}</span>
        )}
      </div>

      {/* docs/ */}
      <DirRow name="docs" />
      {renderPaths(TREE_STRUCTURE.docs, true)}

      {/* src/ */}
      <DirRow name="src" />
      <div style={{ paddingLeft: '16px' }}>
        <DirRow name="assets" />
        {renderPaths(TREE_STRUCTURE.src.assets, true)}
        <DirRow name="auth" />
        {renderPaths(TREE_STRUCTURE.src.auth, true)}
        <DirRow name="utils" />
        {renderPaths(TREE_STRUCTURE.src.utils, true)}
      </div>
    </div>
  );
}

// ── Commit card ───────────────────────────────────────────────
function CommitCard({ result, groupColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {groupColor && (
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: groupColor, flexShrink: 0, boxShadow: `0 0 5px ${groupColor}88` }} />
        )}
        {result.files.map(f => (
          <span key={f} style={{
            fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px',
            background: 'var(--surface2)', borderRadius: '4px',
            color: 'var(--text-muted)', border: '1px solid var(--border)',
          }}>{f}</span>
        ))}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
        {result.subject}
      </div>
      {result.body?.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '4px' }}>
          {result.body.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {result.shell?.length > 0 && (
        <div style={{
          background: '#0a0c14', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
          padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#a0d911',
          lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {result.shell.join('\n')}
        </div>
      )}
    </div>
  );
}

// ── Group color mapping for results ──────────────────────────
function getResultGroupColor(result, groupMap) {
  const gi = groupMap?.get(result.files[0]);
  return gi !== undefined ? GROUP_COLORS[gi % GROUP_COLORS.length] : null;
}

// ── Mode description badge ────────────────────────────────────
function ModeBadge({ mode, cfg, t }) {
  const depth     = cfg.grouping?.directoryDepth ?? 1;
  const minFiles  = cfg.grouping?.minFilesPerGroup ?? 2;
  const threshold = cfg.grouping?.threshold ?? 0.6;

  const hints = {
    'by-tag': fmt(t('previewModeByTag'), { min: minFiles }),
    'by-directory': fmt(t('previewModeByDirectory'), { depth, min: minFiles }),
    'by-similarity': fmt(t('previewModeBySimilarity'), { threshold, min: minFiles }),
  }[mode];

  if (!hints) return null;
  return (
    <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginTop: '2px' }}>
      {hints}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────
const s = {
  panel: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'sticky', top: '16px',
  },
  header: {
    padding: '14px 18px', borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  title: { fontSize: '14px', fontWeight: 600, color: 'var(--text)' },
  tabs: { display: 'flex', gap: '4px' },
  tab: (active) => ({
    padding: '4px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid',
    cursor: 'pointer',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: '12px', fontWeight: active ? 600 : 400,
    transition: 'all 0.15s',
  }),
  body: {
    padding: '14px 18px', display: 'flex', flexDirection: 'column',
    gap: '14px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)',
  },
};

export default function PreviewPanel({ cfg, t }) {
  const [tab, setTab] = useState('single');
  const mode = cfg.grouping?.mode ?? 'per-file';

  const isSingle = tab === 'single';
  const effectiveFiles = getEffectiveFiles(cfg);
  const results  = isSingle ? computeSingle(cfg) : computeMulti(cfg);
  const groupMap = isSingle ? null : computeFileGroups(cfg);
  const showGroupColors = !isSingle && mode !== 'per-file' && mode !== 'none';

  // Which file to highlight in single tab
  const singleEntry = effectiveFiles.find(e => e.path === SINGLE_FILE.path) ?? effectiveFiles[0];
  const singlePath  = singleEntry?.path ?? '';

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>{t('preview')}</span>
        <div style={s.tabs}>
          <button style={s.tab(isSingle)} className="seg-btn" onClick={() => setTab('single')}>{t('previewTabSingle')}</button>
          <button style={s.tab(!isSingle)} className="seg-btn" onClick={() => setTab('multi')}>{t('previewTabMulti')}</button>
        </div>
        {!isSingle && <ModeBadge mode={mode} cfg={cfg} t={t} />}
      </div>

      <div style={s.body}>
        <FolderTree isSingle={isSingle} groupMap={groupMap} mode={mode} effectiveFiles={effectiveFiles} singlePath={singlePath} t={t} />

        {results.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
        )}
        {results.map((r, i) => (
          <React.Fragment key={i}>
            {i > 0 && <hr />}
            <CommitCard
              result={r}
              groupColor={showGroupColors ? getResultGroupColor(r, groupMap) : null}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
