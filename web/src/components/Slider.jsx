import React from 'react';

export default function Slider({ value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const trackStyle = {
    width: '140px',
    background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <input
        type="range"
        className="range-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={trackStyle}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{
          width: String(value).length > 5 ? '90px' : '64px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          padding: '4px 6px',
          fontSize: '13px',
          textAlign: 'right',
        }}
      />
      {unit && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{unit}</span>}
    </div>
  );
}
