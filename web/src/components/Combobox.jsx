import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon.jsx';

export default function Combobox({ value, onChange, options, placeholder }) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState(value ?? '');
  const [activeIdx, setActive]  = useState(-1);
  const wrapRef   = useRef(null);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  useEffect(() => { setQuery(value ?? ''); setActive(-1); }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const select = useCallback((opt) => {
    setQuery(opt);
    onChange(opt);
    setOpen(false);
    setActive(-1);
  }, [onChange]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKey = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      setActive(0);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && filtered[activeIdx]) select(filtered[activeIdx]);
      else if (filtered.length === 1) select(filtered[0]);
      else setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      inputRef.current?.blur();
    }
  };

  const handleInput = (e) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
    setActive(0);
  };

  const handleBlur = (e) => {
    if (wrapRef.current?.contains(e.relatedTarget)) return;
    setOpen(false);
    setActive(-1);
  };

  const isOpen = open && filtered.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', width: '240px' }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          className={isOpen ? 'combobox-input combobox-input--open' : 'combobox-input'}
          value={query}
          onChange={handleInput}
          onFocus={() => { setOpen(true); setActive(filtered.findIndex(o => o === query)); }}
          onBlur={handleBlur}
          onKeyDown={handleKey}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'var(--surface2)',
            border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: isOpen ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
            color: 'var(--text)',
            padding: '5px 28px 5px 9px',
            fontSize: '13px',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            outline: 'none',
          }}
        />
        <Icon
          name="chevron"
          size={12}
          style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
            transition: 'transform 0.18s ease',
            pointerEvents: 'none',
            color: 'var(--text-dim)',
          }}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--accent)', borderTop: 'none',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
            zIndex: 100, maxHeight: '220px', overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {filtered.map((opt, i) => {
            const isActive = i === activeIdx;
            const isSelected = opt === value;
            const idx = opt.toLowerCase().indexOf(query.toLowerCase());
            return (
              <div
                key={opt}
                onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                onMouseEnter={() => setActive(i)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px', fontFamily: 'monospace',
                  color: isActive || isSelected ? 'var(--accent)' : 'var(--text)',
                  background: isActive ? 'rgba(108,99,255,0.12)' : isSelected ? 'var(--accent-dim)' : 'transparent',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s ease',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {isSelected && (
                  <Icon name="check" size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
                <span style={{ flex: 1 }}>
                  {!query || idx === -1 ? opt : <>
                    {opt.slice(0, idx)}
                    <strong style={{ color: 'var(--accent)' }}>{opt.slice(idx, idx + query.length)}</strong>
                    {opt.slice(idx + query.length)}
                  </>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
