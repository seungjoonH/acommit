import React from 'react';

const styles = {
  wrap: {
    display: 'inline-flex', background: 'var(--surface2)',
    borderRadius: 'var(--radius-sm)', padding: '2px', gap: '2px',
  },
  btn: (active) => ({
    padding: '5px 12px', borderRadius: '4px', border: 'none',
    cursor: 'pointer', fontSize: '13px',
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    whiteSpace: 'nowrap',
  }),
};

export default function Segmented({ options, value, onChange }) {
  return (
    <div style={styles.wrap}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`seg-btn${value === opt.value ? ' seg-btn--active' : ''}`}
          style={styles.btn(value === opt.value)}
          onClick={() => onChange(opt.value)}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
