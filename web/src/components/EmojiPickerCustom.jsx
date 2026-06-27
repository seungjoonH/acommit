import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// Curated emoji grid for git commit context
const EMOJI_GRID = [
  // feat / new
  '✨','🚀','🆕','⭐','🎉','🌟','💫','🎊','🔥','💥',
  // fix / bug
  '🐛','🩹','💊','🚑','🔨','🛠️','🔩','🪛','🧯','⚡',
  // docs
  '📝','📚','📖','📄','✍️','📋','🗒️','📰','💬','🔖',
  // chore / refactor
  '♻️','🧹','🧰','⚙️','🔧','🏗️','🧱','🔄','💡','🗂️',
  // test / ci
  '✅','🧪','🔬','🎯','❓','👷','🤖','🚦','🧑‍🔬','🔍',
  // misc
  '📦','🌐','🔑','🔒','📌','🚧','🗑️','🎨','💄','🏷️',
];

const COMMON_BY_TAG = {
  feat: ['✨','🚀','🎉','🆕','⭐'],
  fix:  ['🐛','🩹','🔧','🚑','💊'],
  docs: ['📝','📚','📖','✍️','📋'],
  chore:['🔧','⚙️','🧹','🧰','🔄'],
  refactor:['♻️','🏗️','💡','🔄','🧱'],
  test: ['✅','🧪','🎯','🔬','🚦'],
  perf: ['⚡','🚀','💨','📈','🏎️'],
  build:['📦','🏗️','🔨','🛠️','🔩'],
  ci:   ['👷','🤖','🚦','⚙️','🔄'],
};

export default function EmojiPickerCustom({ tag, emoji, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef();
  const dropdownRef = useRef();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const quickEmojis = COMMON_BY_TAG[tag] ?? COMMON_BY_TAG.feat;

  const dropdown = open && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 200,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '12px',
        width: '240px',
      }}
    >
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {tag} 추천
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {quickEmojis.map((e) => (
            <EmojiBtn key={e} e={e} active={e === emoji} onClick={() => { onChange(tag, e); setOpen(false); }} />
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          전체
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px' }}>
          {EMOJI_GRID.map((e) => (
            <EmojiBtn key={e} e={e} active={e === emoji} onClick={() => { onChange(tag, e); setOpen(false); }} small />
          ))}
        </div>
      </div>

      <button
        onClick={() => { onChange(tag, ''); setOpen(false); }}
        style={{
          marginTop: '8px', width: '100%',
          padding: '4px', background: 'transparent',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
        }}
      >
        제거
      </button>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px',
          background: open ? 'var(--accent-dim)' : 'var(--surface2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--text)',
          transition: 'all 0.15s',
        }}
        title={`${tag} 이모지 변경`}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>{emoji || '➕'}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tag}</span>
      </button>

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}

function EmojiBtn({ e, active, onClick, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: small ? '20px' : '32px',
        height: small ? '20px' : '32px',
        fontSize: small ? '13px' : '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent-dim)' : 'transparent',
        border: active ? '1px solid var(--accent)' : '1px solid transparent',
        borderRadius: '4px', cursor: 'pointer',
        transition: 'background 0.1s',
        padding: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = active ? 'var(--accent-dim)' : 'transparent')}
    >
      {e}
    </button>
  );
}
