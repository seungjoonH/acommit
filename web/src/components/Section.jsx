import React, { useState, useRef, useLayoutEffect } from 'react';
import Icon from './Icon.jsx';

function parseDesc(text) {
  if (!text || !text.includes('`')) return text;
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="desc-code">{part.slice(1, -1)}</code>
      : part
  );
}

const s = {
  section: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer', userSelect: 'none',
  },
  titleWrap: { display: 'flex', flexDirection: 'column', gap: '2px' },
  title: { fontSize: '14px', fontWeight: 600, color: 'var(--text)' },
  desc: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 },
  body: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' },
};

export default function Section({ title, desc, children, defaultOpen = true, extra }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef(null);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      const t = setTimeout(() => { el.style.maxHeight = 'none'; }, 300);
      return () => clearTimeout(t);
    } else {
      // set explicit height first so transition has a start point
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '0';
      const raf = requestAnimationFrame(() => { el.style.maxHeight = '0'; });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  return (
    <div style={s.section}>
      <div className="section-header" style={s.header} onClick={() => setOpen((o) => !o)}>
        <div style={s.titleWrap}>
          <span style={s.title}>{title}</span>
          {desc && <span style={s.desc}>{parseDesc(desc)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {extra}
          <Icon
            name="chevron"
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
      </div>
      <div
        ref={bodyRef}
        className="section-body"
        style={{
          maxHeight: defaultOpen ? 'none' : '0',
          opacity: defaultOpen ? 1 : 0,
        }}
      >
        <div style={s.body}>{children}</div>
      </div>
    </div>
  );
}
