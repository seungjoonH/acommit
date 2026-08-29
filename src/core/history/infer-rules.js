const RECORD_MARKER = '__ACOMMIT_RECORD__';
const FILES_MARKER = '__ACOMMIT_FILES__';
const HANGUL_RE = /[\u3131-\uD79D]/g;
const CONVENTIONAL_RE = /^([a-z][\w-]*)(?:\(([^)]+)\))?\s*[:：]\s*(.+)$/i;
const SQUARE_RE = /^\[([^\]]+)\]\s*[:：]?\s*(.+)$/;
const ROUND_RE = /^\(([^)]+)\)\s*[:：]?\s*(.+)$/;

export function parseHistoryLog(raw) {
  return String(raw || '')
    .split(RECORD_MARKER)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const filesAt = lines.indexOf(FILES_MARKER);
      const header = filesAt >= 0 ? lines.slice(0, filesAt) : lines;
      const files = filesAt >= 0
        ? lines.slice(filesAt + 1).map((line) => line.trim()).filter(Boolean)
        : [];
      const [hash = '', author = '', email = '', subject = '', ...bodyLines] = header;
      return {
        hash: hash.trim(),
        author: author.trim(),
        email: email.trim(),
        subject: subject.trim(),
        body: bodyLines.join('\n').trim(),
        files: [...new Set(files)],
      };
    })
    .filter((commit) => commit.hash && commit.subject);
}

function parseSubject(subject) {
  const text = String(subject || '').trim();
  let match = text.match(CONVENTIONAL_RE);
  if (match) {
    return { tag: match[1], scope: match[2] || null, message: match[3], bracket: 'none' };
  }
  match = text.match(SQUARE_RE);
  if (match) return { tag: match[1], scope: null, message: match[2], bracket: 'square' };
  match = text.match(ROUND_RE);
  if (match) return { tag: match[1], scope: null, message: match[2], bracket: 'round' };
  return { tag: null, scope: null, message: text, bracket: null };
}

function confidence(matched, total) {
  return total ? Number((matched / total).toFixed(2)) : 0;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function inferPathTags(commits, parsedSubjects) {
  const buckets = new Map();
  commits.forEach((commit, index) => {
    const tag = parsedSubjects[index].tag?.toLowerCase();
    if (!tag) return;
    const roots = new Set(commit.files
      .map((file) => file.split('/')[0])
      .filter((root) => root && commit.files.some((file) => file.includes('/'))));
    for (const root of roots) {
      const entry = buckets.get(root) || { total: 0, tags: new Map() };
      entry.total += 1;
      entry.tags.set(tag, (entry.tags.get(tag) || 0) + 1);
      buckets.set(root, entry);
    }
  });

  const mappings = {};
  const evidence = [];
  for (const [root, entry] of buckets) {
    const [tag, count] = [...entry.tags.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (tag && count >= 3 && count / entry.total >= 0.8) {
      mappings[`${root}/**`] = tag;
      evidence.push({ pattern: `${root}/**`, tag, support: count, confidence: confidence(count, entry.total) });
    }
  }
  return { mappings, evidence };
}

export function inferRulesFromHistory(allCommits) {
  const excluded = { merges: 0, reverts: 0, bots: 0 };
  const commits = allCommits.filter((commit) => {
    if (/^revert\b/i.test(commit.subject)) { excluded.reverts += 1; return false; }
    if (/\[bot\]|\bbot\b/i.test(`${commit.author} ${commit.email}`)) { excluded.bots += 1; return false; }
    return true;
  });
  const total = commits.length;
  const parsed = commits.map((commit) => parseSubject(commit.subject));
  const tagged = parsed.filter((item) => item.tag);
  const tagsEnabled = total > 0 && tagged.length / total >= 0.6;
  const tagCounts = new Map();
  tagged.forEach((item) => {
    const tag = item.tag.toLowerCase();
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  });
  const tagList = [...tagCounts.entries()]
    .filter(([, count]) => count >= 2 || count / Math.max(1, tagged.length) >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const hangulChars = commits.reduce((sum, commit) => sum + (commit.subject.match(HANGUL_RE)?.length || 0), 0);
  const letterChars = commits.reduce((sum, commit) => sum + (commit.subject.match(/[A-Za-z\u3131-\uD79D]/g)?.length || 0), 0);
  const lang = letterChars && hangulChars / letterChars >= 0.25 ? 'ko' : 'en';
  const bodies = commits.filter((commit) => commit.body).length;
  const lines = bodies / Math.max(1, total) >= 0.3 ? 'multi' : 'single';
  const wrap = Math.max(50, Math.min(100, percentile(commits.map((commit) => commit.subject.length), 0.9) || 72));
  const bracketCounts = new Map();
  tagged.forEach((item) => bracketCounts.set(item.bracket, (bracketCounts.get(item.bracket) || 0) + 1));
  const bracket = [...bracketCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
  const lowerTags = tagged.filter((item) => item.tag === item.tag.toLowerCase()).length;
  const upperTags = tagged.filter((item) => item.tag === item.tag.toUpperCase()).length;
  const tagCase = upperTags > lowerTags ? 'upper' : 'lower';
  const scoped = tagged.filter((item) => item.scope).length;
  const conventionalRatio = commits.filter((commit) => CONVENTIONAL_RE.test(commit.subject)).length;

  const fileCounts = commits.map((commit) => commit.files.length).filter(Boolean);
  const medianFiles = percentile(fileCounts, 0.5);
  const multi = commits.filter((commit) => commit.files.length > 1);
  const sameRoot = multi.filter((commit) => new Set(commit.files.map((file) => file.split('/')[0])).size === 1).length;
  const groupingMode = medianFiles <= 1 ? 'per-file' : sameRoot / Math.max(1, multi.length) >= 0.75 ? 'by-directory' : 'by-similarity';
  const pathTags = inferPathTags(commits, parsed);

  const suggestedRules = {
    message: {
      lang,
      style: lang === 'ko' ? 'verb' : 'imperative',
      tone: 'concise',
      lines,
      wrap,
    },
    tags: {
      enabled: tagsEnabled,
      ...(tagsEnabled && tagList.length ? { list: tagList } : {}),
      case: tagCase,
      bracket,
      separator: ': ',
    },
    grouping: { mode: groupingMode },
    conventional: {
      compatible: tagged.length > 0 && conventionalRatio / tagged.length >= 0.7,
      scope: { enabled: tagged.length > 0 && scoped / tagged.length >= 0.3, inferFromPath: true },
    },
    ...(Object.keys(pathTags.mappings).length
      ? { ignore: { tagsForPaths: pathTags.mappings } }
      : {}),
  };

  return {
    commitsAnalyzed: total,
    excluded,
    sufficientSample: total >= 10,
    suggestedRules,
    evidence: {
      language: { value: lang, confidence: confidence(lang === 'ko' ? hangulChars : letterChars - hangulChars, letterChars) },
      taggedMessages: { matched: tagged.length, total, confidence: confidence(tagged.length, total) },
      multiLineMessages: { matched: bodies, total, confidence: confidence(bodies, total) },
      conventional: { matched: conventionalRatio, total: tagged.length, confidence: confidence(conventionalRatio, tagged.length) },
      grouping: { medianFiles, multiFileCommits: multi.length, sameRootMultiFileCommits: sameRoot },
      pathTags: pathTags.evidence,
      tagCounts: Object.fromEntries(tagCounts),
    },
  };
}
