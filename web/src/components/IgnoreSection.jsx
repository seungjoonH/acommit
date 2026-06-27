import React, { useState } from 'react';
import Section from './Section.jsx';
import Field from './Field.jsx';
import { ensureMappedTagsInList } from '../rules/syncTags.js';

const inputStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '5px 9px',
  fontSize: '12px',
  fontFamily: 'monospace',
};

function TagsForPathsEditor({ value, onChange, onSyncTags, t }) {
  const [newPath, setNewPath] = useState('');
  const [newTag, setNewTag] = useState('');
  const entries = Object.entries(value ?? {});

  const renamePath = (oldPath, newPathVal, currentTag) => {
    const trimmed = newPathVal.trim();
    if (trimmed === oldPath) return;
    const next = { ...value };
    delete next[oldPath];
    if (trimmed) next[trimmed] = currentTag;
    onChange(next);
  };

  const updateTag = (path, newTagVal) => {
    onChange({ ...value, [path]: newTagVal });
  };

  const remove = (key) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const add = () => {
    const p = newPath.trim();
    const tg = newTag.trim();
    if (!p || !tg) return;
    onSyncTags({ ...value, [p]: tg });
    setNewPath('');
    setNewTag('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {entries.map(([path, tag]) => (
        <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            defaultValue={path}
            onBlur={(e) => renamePath(path, e.target.value, tag)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>
          <input
            style={{ ...inputStyle, width: '80px' }}
            value={tag}
            onChange={(e) => updateTag(path, e.target.value)}
            onBlur={() => onSyncTags(value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <button
            onClick={() => remove(path)}
            className="chip-del"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', transition: 'color 0.15s' }}
          >✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          placeholder={t('ignorePathPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>
        <input
          style={{ ...inputStyle, width: '80px' }}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder={t('ignoreTagPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          style={{
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)', color: 'var(--accent)',
            padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
          }}
        >{t('ignoreAddMapping')}</button>
      </div>
    </div>
  );
}

export default function IgnoreSection({ cfg, onChange, t }) {
  const ignore = cfg.ignore ?? {};

  const setTagsForPaths = (v) => {
    onChange({ ...cfg, ignore: { ...ignore, tagsForPaths: v } });
  };

  const syncTagsForPaths = (v) => {
    const next = ensureMappedTagsInList(
      { ...cfg, ignore: { ...ignore, tagsForPaths: v } },
      v,
    );
    onChange(next);
  };

  return (
    <Section title={t('ignore')} desc={t('ignoreDesc')} defaultOpen={false}>
      <Field label={t('ignoreTagsForPaths')} id="ignore.tagsForPaths" desc={t('ignoreTagsForPathsDesc')} horizontal={false}>
        <TagsForPathsEditor
          value={ignore.tagsForPaths ?? {}}
          onChange={setTagsForPaths}
          onSyncTags={syncTagsForPaths}
          t={t}
        />
      </Field>
    </Section>
  );
}
