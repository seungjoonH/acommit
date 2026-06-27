import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from './components/Icon.jsx';
import Toast from './components/Toast.jsx';

// ── i18n ──────────────────────────────────────────────────────
const STRINGS = {
  ko: {
    title: 'acommit result',
    noSession: '세션 없음',
    empty: '결과 없음',
    emptyHint: 'acommit commit 실행 후 여기에 결과가 저장됩니다',
    copyAll: '전체 복사',
    runAll: '전체 실행',
    running: '실행 중…',
    copy: '복사',
    run: '실행',
    fileTree: '파일 구조',
    files: (n) => `${n}개 파일`,
    commits: (n) => `${n}개 커밋`,
    grouping: '그룹화',
    batchFormat: '일괄 포맷',
    style: 'style',
    sep: 'sep',
    copied: '복사됨',
    copyFail: '복사 실패',
    commitDone: '커밋 완료',
    allDone: (n) => `${n}개 커밋 완료`,
    runFail: (msg) => `실패: ${msg}`,
    runErr: (msg) => `오류: ${msg}`,
    sessionFetchErr: '세션 목록을 불러올 수 없습니다',
    sessionLoadErr: '세션을 불러올 수 없습니다',
  },
  en: {
    title: 'acommit result',
    noSession: 'No sessions',
    empty: 'No results yet',
    emptyHint: 'Run acommit commit — results will appear here',
    copyAll: 'Copy all',
    runAll: 'Run all',
    running: 'Running…',
    copy: 'Copy',
    run: 'Run',
    fileTree: 'File tree',
    files: (n) => `${n} file${n !== 1 ? 's' : ''}`,
    commits: (n) => `${n} commit${n !== 1 ? 's' : ''}`,
    grouping: 'Grouping',
    batchFormat: 'Batch format',
    style: 'style',
    sep: 'sep',
    copied: 'Copied',
    copyFail: 'Copy failed',
    commitDone: 'Committed',
    allDone: (n) => `${n} commit${n !== 1 ? 's' : ''} done`,
    runFail: (msg) => `Failed: ${msg}`,
    runErr: (msg) => `Error: ${msg}`,
    sessionFetchErr: 'Could not load session list',
    sessionLoadErr: 'Could not load session',
  },
};

// ── Helpers ───────────────────────────────────────────────────
function buildSubjectPrefix(tag, tagStyle, tagSeparator) {
  if (!tag) return '';
  const sep = tagSeparator ?? ': ';
  const styleStr = (tagStyle ?? '{tag}').trim();
  const rendered = styleStr
    .replace(/\{tag\}/g,   tag.toLowerCase())
    .replace(/\{TAG\}/g,   tag.toUpperCase())
    .replace(/\{Tag\}/g,   tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase())
    .replace(/\{scope\}/g, '')
    .replace(/\{sep\}/g,   sep);
  return rendered.endsWith(sep) ? rendered : rendered + sep;
}

function rebuildSubject(commit, tagStyle, tagSeparator) {
  if (!commit.tag || !commit.message) return commit.subject;
  return buildSubjectPrefix(commit.tag, tagStyle, tagSeparator) + commit.message;
}

function escapePath(p) {
  return p.replace(/[\[\]()]/g, '\\$&');
}

function rebuildShell(commit, subject) {
  const files = commit.files ?? [];
  const lines = [];
  if (files.length) lines.push(`git add ${files.map(escapePath).join(' ')}`);
  const escaped = subject.replace(/"/g, '\\"');
  lines.push(`git commit -m "${escaped}"`);
  return lines;
}

// Normalize sessions saved with old default ({tag}: / separator " ")
function normalizeTagFormat(style, sep) {
  if (style === '{tag}:' && sep === ' ') return ['{tag}', ': '];
  return [style, sep];
}

const TAG_COLOR = {
  feat: '#6c63ff', fix: '#e74c3c', docs: '#3498db', chore: '#95a5a6',
  refactor: '#e67e22', test: '#27ae60', perf: '#f39c12', build: '#8e44ad', ci: '#16a085',
};
function tagColor(tag) { return TAG_COLOR[tag] ?? '#6b7280'; }

function TagBadge({ tag }) {
  if (!tag) return null;
  const c = tagColor(tag);
  return (
    <span style={{
      fontSize: '10px', padding: '1px 6px', borderRadius: '3px',
      fontFamily: 'monospace', fontWeight: 700, flexShrink: 0,
      background: c + '22', color: c, border: `1px solid ${c}44`,
    }}>{tag}</span>
  );
}

// ── File tree ─────────────────────────────────────────────────
function buildTree(commits) {
  const root = { children: {}, files: [] };
  commits.forEach((commit, idx) => {
    (commit.files ?? []).forEach(filePath => {
      const parts = filePath.split('/');
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node.children[parts[i]]) node.children[parts[i]] = { children: {}, files: [] };
        node = node.children[parts[i]];
      }
      node.files.push({ name: parts[parts.length - 1], path: filePath, commitIdx: idx, tag: commit.tag });
    });
  });
  return root;
}

function TreeNode({ name, node, depth, onFileClick }) {
  const hasChildren = Object.keys(node.children).length > 0 || node.files.length > 0;
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 14;
  const isRoot = name === undefined;

  return (
    <div>
      {!isRoot && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: `3px 10px 3px ${8 + indent}px`,
            cursor: 'pointer', userSelect: 'none', borderRadius: '4px',
          }}
          className="tree-row"
        >
          <Icon
            name="chevron"
            size={10}
            style={{
              color: 'var(--text-dim)', flexShrink: 0,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.12s',
            }}
          />
          <Icon
            name={open ? 'folder-open' : 'folder'}
            size={13}
            style={{ color: '#e6a817', flexShrink: 0 }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1 }}>{name}</span>
        </div>
      )}
      {(isRoot || open) && (
        <>
          {node.files.map((f, i) => {
            const c = tagColor(f.tag);
            return (
              <div
                key={i}
                onClick={() => onFileClick?.(f.commitIdx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: `3px 8px 3px ${(isRoot ? 8 : 8 + indent + 14)}px`,
                  cursor: 'pointer', userSelect: 'none', borderRadius: '4px',
                  overflow: 'hidden',
                }}
                className="tree-row"
              >
                <Icon name="file-text" size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <span style={{
                  flex: '1 1 0', minWidth: 0,
                  fontSize: '12px', color: 'var(--text-dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1,
                  fontFamily: 'monospace',
                }}>{f.name}</span>
                <span style={{
                  fontSize: '9px', padding: '1px 4px', borderRadius: '3px', flexShrink: 0,
                  background: c + '22', color: c, border: `1px solid ${c}33`,
                  fontFamily: 'monospace', fontWeight: 700,
                }}>#{f.commitIdx + 1}</span>
              </div>
            );
          })}
          {Object.entries(node.children)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([childName, childNode]) => (
              <TreeNode
                key={childName} name={childName} node={childNode}
                depth={isRoot ? 0 : depth + 1} onFileClick={onFileClick}
              />
            ))}
        </>
      )}
    </div>
  );
}

function Sidebar({ commits, onFileClick, t }) {
  const tree = buildTree(commits);
  const totalFiles = commits.reduce((n, c) => n + (c.files?.length ?? 0), 0);

  return (
    <div style={{
      width: '220px', flexShrink: 0, borderRight: '1px solid var(--border)',
      position: 'sticky', top: '45px', height: 'calc(100vh - 45px)',
      overflowY: 'auto', overflowX: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Sidebar header */}
      <div style={{
        padding: '10px 10px 6px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '6px',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
      }}>
        <Icon name="folder" size={13} style={{ color: '#e6a817' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{t.fileTree}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {t.files(totalFiles)}
        </span>
      </div>
      {/* Tree */}
      <div style={{ padding: '4px 0 12px' }}>
        <TreeNode name={undefined} node={tree} depth={0} onFileClick={onFileClick} />
      </div>

      <style>{`
        .tree-row:hover { background: var(--surface2); }
      `}</style>
    </div>
  );
}

// ── Commit card ───────────────────────────────────────────────
const mkBtn = (variant = 'default') => ({
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '3px 8px', borderRadius: '4px',
  fontSize: '11px', cursor: 'pointer', fontWeight: 500,
  border: variant === 'accent' ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: variant === 'accent' ? 'var(--accent-dim)' : 'transparent',
  color: variant === 'accent' ? 'var(--accent)' : 'var(--text-muted)',
});

function CommitCard({ commit, index, tagStyle, tagSeparator, onToast, cardRef, t }) {
  const computed = rebuildSubject(commit, tagStyle, tagSeparator);
  const [subject, setSubject] = useState(computed);
  const [running, setRunning] = useState(false);
  const prevComputed = useRef(computed);

  useEffect(() => {
    if (prevComputed.current !== computed && subject === prevComputed.current) {
      setSubject(computed);
    }
    prevComputed.current = computed;
  }, [computed]);

  const shellLines = rebuildShell(commit, subject);
  const files = commit.files ?? [];
  const MAX_BADGES = 4;

  const copy = () => {
    navigator.clipboard.writeText(shellLines.join('\n'))
      .then(() => onToast(t.copied, 'success'))
      .catch(() => onToast(t.copyFail, 'error'));
  };

  const execute = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: shellLines }),
      });
      const data = await res.json();
      if (data.aborted) {
        const failed = data.results.find(r => !r.ok);
        onToast(t.runFail(failed?.stderr || '?'), 'error');
      } else {
        onToast(t.commitDone, 'success');
      }
    } catch (e) {
      onToast(t.runErr(e.message), 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div ref={cardRef} style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', marginBottom: '8px', overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        padding: '5px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace',
          background: 'var(--surface2)', padding: '1px 5px', borderRadius: '3px',
          border: '1px solid var(--border)', flexShrink: 0,
        }}>#{index + 1}</span>
        <TagBadge tag={commit.tag} />
        {files.slice(0, MAX_BADGES).map(f => (
          <span key={f} style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '10px', fontFamily: 'monospace', padding: '1px 5px',
            background: 'var(--surface2)', borderRadius: '3px',
            color: 'var(--text-dim)', border: '1px solid var(--border)',
            maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={f}>
            <Icon name="file-text" size={10} style={{ flexShrink: 0 }} />
            {f.split('/').pop()}
          </span>
        ))}
        {files.length > MAX_BADGES && (
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>+{files.length - MAX_BADGES}</span>
        )}
        <div style={{ flex: 1 }} />
        <button style={mkBtn()} onClick={copy}>{t.copy}</button>
        <button style={mkBtn('accent')} onClick={execute} disabled={running}>
          {running ? '…' : t.run}
        </button>
      </div>
      {/* Subject + shell */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          style={{
            width: '100%', fontFamily: 'monospace', fontSize: '13px', fontWeight: 600,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: '4px', color: 'var(--text)',
            padding: '5px 10px', boxSizing: 'border-box',
          }}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          spellCheck={false}
        />
        <div style={{
          background: '#0a0c14', borderRadius: '4px',
          border: '1px solid var(--border)', padding: '6px 10px',
          fontFamily: 'monospace', fontSize: '11px', color: '#a0d911',
          lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>{shellLines.join('\n')}</div>
      </div>
    </div>
  );
}

// ── Format toolbar ────────────────────────────────────────────
function FormatToolbar({ tagStyle, tagSeparator, onStyleChange, onSepChange, commits, t }) {
  const preview = (() => {
    const first = commits?.find(c => c.tag);
    if (!first) return '';
    return rebuildSubject(first, tagStyle, tagSeparator);
  })();

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '4px', color: 'var(--text)',
    padding: '3px 7px', fontSize: '12px', fontFamily: 'monospace',
  };

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '7px 12px', marginBottom: '10px',
      display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.batchFormat}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{t.style}</span>
        <input style={{ ...inp, width: '110px' }} value={tagStyle}
          onChange={e => onStyleChange(e.target.value)} placeholder="{tag}" spellCheck={false} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{t.sep}</span>
        <input style={{ ...inp, width: '46px' }} value={tagSeparator}
          onChange={e => onSepChange(e.target.value)} placeholder=": " spellCheck={false} />
      </div>
      {preview && (
        <span style={{
          fontFamily: 'monospace', fontSize: '11px',
          color: 'var(--accent)', background: 'var(--accent-dim)',
          padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--accent)',
        }}>{preview}</span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ResultPage() {
  const [locale, setLocale] = useState('ko');
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [session, setSession] = useState(null);
  const [tagStyle, setTagStyle] = useState('{tag}');
  const [tagSeparator, setTagSeparator] = useState(': ');
  const [toast, setToast] = useState(null);
  const [executing, setExecuting] = useState(false);
  const cardRefs = useRef([]);
  const t = STRINGS[locale] ?? STRINGS.ko;

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  useEffect(() => {
    fetch('/api/locale').then(r => r.json()).then(d => setLocale(d.locale === 'en' ? 'en' : 'ko')).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => { setSessions(data); if (data.length > 0) setSelectedId(data[0].id); })
      .catch(() => showToast(t.sessionFetchErr, 'error'));
  }, [locale]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/sessions/${selectedId}`)
      .then(r => r.json())
      .then(data => {
        setSession(data);
        const [style, sep] = normalizeTagFormat(data.tagStyle ?? '{tag}', data.tagSeparator ?? ': ');
        setTagStyle(style);
        setTagSeparator(sep);
      })
      .catch(() => showToast(t.sessionLoadErr, 'error'));
  }, [selectedId]);

  const allShellLines = session?.commits?.flatMap(c =>
    rebuildShell(c, rebuildSubject(c, tagStyle, tagSeparator))
  ) ?? [];

  const copyAll = () => {
    navigator.clipboard.writeText(allShellLines.join('\n'))
      .then(() => showToast(t.copied, 'success'))
      .catch(() => showToast(t.copyFail, 'error'));
  };

  const executeAll = async () => {
    setExecuting(true);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: allShellLines }),
      });
      const data = await res.json();
      if (data.aborted) {
        showToast(t.runFail(data.results.find(r => !r.ok)?.stderr || '?'), 'error');
      } else {
        showToast(t.allDone(session.commits.length), 'success');
      }
    } catch (e) {
      showToast(t.runErr(e.message), 'error');
    } finally {
      setExecuting(false);
    }
  };

  const scrollToCard = (idx) => {
    cardRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch { return iso; }
  };

  const GROUP_SHORT = {
    'per-file': 'file', 'by-similarity': 'sim', 'by-tag': 'tag',
    'by-directory': 'dir', 'none': 'none',
  };

  const shortLabel = (s) => `${s.id}  ${s.commitCount}c`;

  const HEADER_H = 45;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ── Top header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 200, height: `${HEADER_H}px`,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          {t.title}
        </span>
        <select
          style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: '4px', color: 'var(--text)',
            padding: '3px 8px', fontSize: '12px', cursor: 'pointer', flex: 1, maxWidth: '400px',
          }}
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {sessions.length === 0 && <option value="">{t.noSession}</option>}
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{shortLabel(s)}</option>
          ))}
        </select>
        {session && (
          <>
            <button style={mkBtn()} onClick={copyAll}>{t.copyAll}</button>
            <button style={mkBtn('accent')} onClick={executeAll} disabled={executing}>
              {executing ? t.running : t.runAll}
            </button>
          </>
        )}
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: `calc(100vh - ${HEADER_H}px)` }}>
      <div style={{ display: 'flex', width: '100%', maxWidth: '1100px' }}>
        {/* Sidebar */}
        {session && (
          <Sidebar commits={session.commits ?? []} onFileClick={scrollToCard} t={t} />
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, padding: '14px 18px 60px', overflowX: 'hidden' }}>
          {!session && sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <p style={{ marginBottom: '6px' }}>{t.empty}</p>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '11px' }}>{t.emptyHint}</p>
            </div>
          )}

          {session && (
            <>
              {/* Meta */}
              <div style={{
                display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap',
                fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace',
              }}>
                <span>{formatDate(session.timestamp)}</span>
                <span>{session.provider} / {session.model}</span>
                <span>{t.grouping}: {session.groupingMode}</span>
                <span>{t.commits(session.commits?.length ?? 0)}</span>
              </div>

              <FormatToolbar
                tagStyle={tagStyle} tagSeparator={tagSeparator}
                onStyleChange={setTagStyle} onSepChange={setTagSeparator}
                commits={session.commits} t={t}
              />

              {(session.commits ?? []).map((commit, i) => (
                <CommitCard
                  key={i} index={i} commit={commit}
                  tagStyle={tagStyle} tagSeparator={tagSeparator}
                  onToast={showToast} t={t}
                  cardRef={el => { cardRefs.current[i] = el; }}
                />
              ))}
            </>
          )}
        </div>
      </div>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} />}
    </div>
  );
}
