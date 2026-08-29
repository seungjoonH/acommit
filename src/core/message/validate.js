function detectTag(subject) {
  const text = String(subject || '').trim();
  const square = text.match(/^\[([^\]]+)\]/);
  if (square) return square[1].split(':')[0].trim().toLowerCase();
  const round = text.match(/^\(([^)]+)\)/);
  if (round) return round[1].split(':')[0].trim().toLowerCase();
  const conventional = text.match(/^([a-z][\w-]*)(?:\([^)]+\))?\s*[:：]/i);
  return conventional ? conventional[1].toLowerCase() : null;
}

export function validateGeneratedCommit(parsed, cfg = {}) {
  const issues = [];
  const subject = String(parsed?.subject || '').trim();
  const body = Array.isArray(parsed?.body) ? parsed.body : [];
  const files = Array.isArray(parsed?.files) ? parsed.files : [];
  const tag = detectTag(subject);

  if (!subject) issues.push({ code: 'message.empty', message: 'Commit subject is empty.' });
  if (!files.length) issues.push({ code: 'files.empty', message: 'Commit file list is empty.' });

  const linesMode = cfg.message?.lines || 'single';
  if (linesMode === 'single' && body.length) {
    issues.push({ code: 'message.lines.single', message: 'Single-line mode does not allow body bullets.' });
  }
  if (linesMode === 'multi' && !body.length) {
    issues.push({ code: 'message.lines.multi', message: 'Multi-line mode requires at least one body bullet.' });
  }

  const wrap = Number(cfg.message?.wrap);
  if (Number.isFinite(wrap) && wrap > 0 && subject.length > wrap) {
    issues.push({ code: 'message.wrap', message: `Commit subject exceeds ${wrap} characters.` });
  }

  if (cfg.tags?.enabled === false && tag) {
    issues.push({ code: 'tags.disabled', message: `Tag "${tag}" is present while tags are disabled.` });
  }
  if (cfg.tags?.enabled !== false) {
    const allowed = new Set((cfg.tags?.list || []).map((item) => String(item).toLowerCase()));
    if (!tag) {
      issues.push({ code: 'tags.missing', message: 'Commit subject is missing a tag.' });
    } else if (allowed.size && !allowed.has(tag)) {
      issues.push({ code: 'tags.not-allowed', message: `Tag "${tag}" is not allowed.` });
    }
  }

  return { ok: issues.length === 0, issues };
}
