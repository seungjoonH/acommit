import React, { useEffect } from 'react';
import Icon from './Icon.jsx';

const variants = {
  success: { bg: 'var(--green-dim)',   border: 'var(--green)',  color: 'var(--green)',  icon: 'check' },
  error:   { bg: 'var(--red-dim)',     border: 'var(--red)',    color: 'var(--red)',    icon: 'x' },
  info:    { bg: 'var(--accent-dim)',  border: 'var(--accent)', color: 'var(--accent)', icon: 'info' },
};

export default function Toast({ message, type = 'success', onDismiss }) {
  const v = variants[type] ?? variants.info;
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 16px',
      background: v.bg, border: `1px solid ${v.border}`,
      borderRadius: 'var(--radius)', color: v.color,
      fontSize: '13px', fontWeight: 500, boxShadow: 'var(--shadow)',
    }}>
      <Icon name={v.icon} size={14} />
      <span>{message}</span>
    </div>
  );
}
