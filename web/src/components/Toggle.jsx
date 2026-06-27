import React from 'react';

export default function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
        />
        <span
          className="toggle-track"
          style={{
            position: 'absolute', inset: 0, borderRadius: '20px',
            background: checked ? 'var(--accent)' : 'var(--border)',
          }}
        />
        <span
          className="toggle-thumb"
          style={{
            position: 'absolute', top: '3px',
            left: checked ? '19px' : '3px',
            width: '14px', height: '14px',
            borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </span>
      {label && <span style={{ fontSize: '13px', color: 'var(--text)' }}>{label}</span>}
    </label>
  );
}
