import React, { useEffect } from 'react';

export default function UnsavedModal({ onConfirm, onCancel, t }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '28px 32px',
          maxWidth: '360px',
          width: '90%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {t('modalTitle')}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('modalBody')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
            }}
          >
            {t('modalCancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '7px 18px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'var(--red)', color: '#fff',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}
          >
            {t('modalDiscard')}
          </button>
        </div>
      </div>
    </div>
  );
}
