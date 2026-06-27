import React from 'react';

function parseDesc(text) {
  if (!text || !text.includes('`')) return text;
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="desc-code">{part.slice(1, -1)}</code>
      : part
  );
}

const s = {
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  row: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  labelWrap: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' },
  label: { fontSize: '13px', fontWeight: 500, color: 'var(--text)' },
  id: { fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: '0.02em' },
  desc: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 },
  control: { flexShrink: 0 },
};

export default function Field({ id, label, desc, children, horizontal = true }) {
  const descEl = desc ? <span style={s.desc}>{parseDesc(desc)}</span> : null;

  if (!horizontal) {
    return (
      <div style={s.field}>
        <div style={s.labelWrap}>
          {label && <span style={s.label}>{label}</span>}
          {id && <span style={s.id}>{id}</span>}
        </div>
        {descEl}
        {children}
      </div>
    );
  }
  return (
    <div style={s.field}>
      <div style={s.row}>
        <div style={s.labelWrap}>
          {label && <span style={s.label}>{label}</span>}
          {id && <span style={s.id}>{id}</span>}
          {desc && <span style={{ ...s.desc, maxWidth: '260px' }}>{parseDesc(desc)}</span>}
        </div>
        <div style={s.control}>{children}</div>
      </div>
    </div>
  );
}
