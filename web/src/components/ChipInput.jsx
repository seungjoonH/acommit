import React, { useState, useRef } from 'react';

const s = {
  wrap: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px',
    background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', minHeight: '38px', alignItems: 'center',
    transition: 'border-color 0.15s ease',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '2px 8px',
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    borderRadius: '12px', fontSize: '12px', color: 'var(--text)', fontFamily: 'monospace',
  },
  del: {
    cursor: 'pointer', color: 'var(--text-muted)',
    fontSize: '11px', lineHeight: 1, padding: '0 1px',
    background: 'none', border: 'none',
  },
  input: {
    flex: 1, minWidth: '80px', background: 'transparent',
    border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace',
  },
};

export default function ChipInput({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const ref = useRef();

  const add = (val) => {
    const v = val.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  const remove = (idx) => onChange(values.filter((_, i) => i !== idx));
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
    if (e.key === 'Backspace' && draft === '' && values.length > 0) remove(values.length - 1);
  };

  return (
    <div className="chip-input-wrap" style={s.wrap} onClick={() => ref.current?.focus()}>
      {values.map((v, i) => (
        <span key={i} style={s.chip}>
          {v}
          <button className="chip-del" style={s.del} onClick={(e) => { e.stopPropagation(); remove(i); }}>✕</button>
        </span>
      ))}
      <input
        ref={ref} style={s.input} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && add(draft)}
        placeholder={values.length === 0 ? placeholder : ''}
      />
    </div>
  );
}
