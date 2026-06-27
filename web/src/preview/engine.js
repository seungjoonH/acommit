// Client-side preview engine — no LLM, rule-based only.

import { matchesAnyGlob, resolveForcedTag } from '@acommit/core/ignore/match.js';
import {
  buildTagPrefix,
  createTagRenderer,
  describeTagExample as coreDescribeTagExample,
  resolveCommitTag,
} from '@acommit/core/tags/render.js';

const DEFAULT_EMOJI_MAP = {
  feat: '✨', fix: '🐛', docs: '📝', chore: '🔧',
  refactor: '♻️', test: '✅', perf: '⚡', build: '📦', ci: '👷',
  image: '🖼️',
};

export const MULTI_FILES = [
  { path: 'src/auth/login.js',         tag: 'fix',   msgKo: '로그인 유효성 검사 수정',  msgEn: 'Fix login validation',  binary: false },
  { path: 'src/auth/logout.js',        tag: 'fix',   msgKo: '로그아웃 세션 정리 수정',  msgEn: 'Fix logout session',    binary: false },
  { path: 'src/auth/middleware.js',    tag: 'fix',   msgKo: '인증 미들웨어 수정',       msgEn: 'Fix auth middleware',   binary: false },
  { path: 'src/utils/format.js',       tag: 'feat',  msgKo: '포맷 유틸 추가',           msgEn: 'Add format util',       binary: false },
  { path: 'src/utils/counter.js',      tag: 'feat',  msgKo: '카운터 유틸 추가',         msgEn: 'Add counter util',      binary: false },
  { path: 'docs/api.md',               tag: 'docs',  msgKo: 'API 문서 업데이트',        msgEn: 'Update API docs',       binary: false },
  { path: 'src/assets/logo.png',       tag: 'chore', msgKo: '로고 이미지 추가',         msgEn: 'Add logo image',        binary: true  },
];

export const SINGLE_FILE = MULTI_FILES[4];

export function getEffectiveFiles(cfg) {
  const skipGlobs = cfg.diff?.skip ?? [];
  const tagsForPaths = cfg.ignore?.tagsForPaths ?? {};
  const includeBinary = cfg.diff?.includeBinary !== false;

  return MULTI_FILES
    .filter(e => !matchesAnyGlob(skipGlobs, e.path))
    .filter(e => includeBinary || !e.binary)
    .map(e => {
      const forced = resolveForcedTag(e.path, tagsForPaths);
      return forced ? { ...e, tag: forced } : e;
    });
}

function normalizedCfg(cfg) {
  const tags = cfg.tags ?? {};
  const render = tags.render ?? createTagRenderer(tags);
  return { ...cfg, tags: { ...tags, render } };
}

function applyStyle(text, style, lang) {
  if (lang === 'ko') {
    return style === 'declarative' ? text + '함' : text;
  }
  if (style === 'past') {
    if (text.startsWith('Add '))      return 'Added '      + text.slice(4);
    if (text.startsWith('Fix '))      return 'Fixed '      + text.slice(4);
    if (text.startsWith('Update '))   return 'Updated '    + text.slice(7);
    if (text.startsWith('Remove '))   return 'Removed '    + text.slice(7);
    if (text.startsWith('Refactor ')) return 'Refactored ' + text.slice(9);
    return text;
  }
  return text;
}

function applyEmoji(prefix, emojiMap, tag) {
  const e = emojiMap?.[tag];
  return e ? `${e} ${prefix}` : prefix;
}

function dominantTag(entries) {
  const counts = {};
  entries.forEach(e => { counts[e.tag] = (counts[e.tag] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function buildResult(cfg, files, tag, rawMsg, bodyLines, opts) {
  const { lang, style, lines, tone, emojiEnabled, emojiMap } = opts;
  const nc = normalizedCfg(cfg);
  const msg = applyStyle(rawMsg, style, lang);
  const commitTag = resolveCommitTag(nc, tag);
  const prefix = buildTagPrefix(nc, commitTag, files[0]);
  const prefixed = emojiEnabled ? applyEmoji(prefix, emojiMap, commitTag) : prefix;
  const subject = `${prefixed}${msg}`;

  let effectiveBody = bodyLines ?? [];
  if (tone === 'detailed' && effectiveBody.length > 0) {
    const ctx = lang === 'ko' ? '관련 테스트 및 문서 업데이트 포함' : 'Includes related tests and documentation updates';
    effectiveBody = [...effectiveBody, ctx];
  }

  const body = lines === 'multi' && effectiveBody.length ? effectiveBody.map(l => `- ${l}`) : [];
  const bodyArgs = body.map(l => ` -m "${l}"`).join('');
  return {
    files,
    subject,
    body,
    shell: files.length > 0
      ? [...files.map(f => `git add ${f}`), `git commit -m "${subject}"${bodyArgs}`]
      : [],
  };
}

function chunkBy(arr, maxSize) {
  if (!maxSize || arr.length <= maxSize) return [arr];
  const chunks = [];
  for (let i = 0; i < arr.length; i += maxSize) chunks.push(arr.slice(i, i + maxSize));
  return chunks;
}

function getDirKey(filePath, depth) {
  const parts = filePath.split('/');
  return parts.slice(0, depth).join('/');
}

export function computeSingle(cfg) {
  const opts = getOpts(cfg);
  const effective = getEffectiveFiles(cfg);
  const entry = effective.find(e => e.path === SINGLE_FILE.path) ?? effective[0];
  if (!entry) return [];
  const bodyLines = opts.lang === 'ko'
    ? ['파일 줄 수를 세는 countLines 메서드 추가']
    : ['Add countLines method to count file lines'];
  return [buildResult(cfg, [entry.path], entry.tag,
    opts.lang === 'ko' ? entry.msgKo : entry.msgEn, bodyLines, opts)];
}

function getOpts(cfg) {
  return {
    lang:         cfg.message?.lang          ?? 'ko',
    style:        cfg.message?.style         ?? 'verb',
    lines:        cfg.message?.lines         ?? 'single',
    tone:         cfg.message?.tone          ?? 'concise',
    emojiEnabled: cfg.message?.emoji?.enabled ?? false,
    emojiMap:     { ...DEFAULT_EMOJI_MAP, ...(cfg.message?.emoji?.map ?? {}) },
  };
}

export function computeMulti(cfg) {
  const opts = getOpts(cfg);
  const files = getEffectiveFiles(cfg);
  const mode = cfg.grouping?.mode ?? 'per-file';
  const minFiles = cfg.grouping?.minFilesPerGroup ?? 2;
  const depth    = cfg.grouping?.directoryDepth   ?? 1;
  const threshold = cfg.grouping?.threshold       ?? 0.6;
  const maxGroup  = cfg.grouping?.maxGroupSize     ?? 10;

  if (files.length === 0) return [];

  if (mode === 'none') {
    return files.map(e => {
      const raw = opts.lang === 'ko' ? e.msgKo : e.msgEn;
      return buildResult(cfg, [e.path], e.tag, raw, null, opts);
    });
  }

  if (mode === 'per-file') {
    return files.map(e => {
      const raw = opts.lang === 'ko' ? e.msgKo : e.msgEn;
      return buildResult(cfg, [e.path], e.tag, raw, null, opts);
    });
  }

  if (mode === 'by-tag') {
    const tagMap = {};
    files.forEach(e => { (tagMap[e.tag] = tagMap[e.tag] ?? []).push(e); });

    const results = [];
    Object.entries(tagMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([tag, entries]) => {
      if (entries.length < minFiles) {
        entries.forEach(e => {
          const raw = opts.lang === 'ko' ? e.msgKo : e.msgEn;
          results.push(buildResult(cfg, [e.path], tag, raw, null, opts));
        });
        return;
      }
      const groupMsg = {
        fix:  opts.lang === 'ko' ? '인증 관련 버그 수정' : 'Fix auth-related bugs',
        feat: opts.lang === 'ko' ? '유틸리티 추가'       : 'Add utilities',
        docs: opts.lang === 'ko' ? 'API 문서 업데이트'   : 'Update API docs',
      }[tag] ?? (opts.lang === 'ko' ? `${tag} 업데이트` : `Update ${tag}`);
      const bodyLines = {
        fix:  opts.lang === 'ko' ? entries.map(e => e.msgKo) : entries.map(e => e.msgEn),
        feat: opts.lang === 'ko' ? entries.map(e => e.msgKo) : entries.map(e => e.msgEn),
        docs: opts.lang === 'ko' ? ['엔드포인트 예시 추가'] : ['Add endpoint examples'],
      }[tag] ?? (opts.lang === 'ko' ? entries.map(e => e.msgKo) : entries.map(e => e.msgEn));
      results.push(buildResult(cfg, entries.map(e => e.path), tag, groupMsg, bodyLines, opts));
    });
    return results;
  }

  if (mode === 'by-directory') {
    const dirMap = {};
    files.forEach(e => {
      const key = getDirKey(e.path, depth);
      (dirMap[key] = dirMap[key] ?? []).push(e);
    });

    const results = [];
    Object.entries(dirMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([dir, entries]) => {
      if (entries.length < minFiles) {
        entries.forEach(e => {
          const raw = opts.lang === 'ko' ? e.msgKo : e.msgEn;
          results.push(buildResult(cfg, [e.path], e.tag, raw, null, opts));
        });
        return;
      }
      const tag = dominantTag(entries);
      const dirName = dir.split('/').pop();
      const groupMsg = opts.lang === 'ko'
        ? `${dirName} 업데이트`
        : `Update ${dirName}`;
      const bodyLines = entries.map(e => opts.lang === 'ko' ? e.msgKo : e.msgEn);
      results.push(buildResult(cfg, entries.map(e => e.path), tag, groupMsg, bodyLines, opts));
    });
    return results;
  }

  if (mode === 'by-similarity') {
    function similarity(a, b) {
      if (a === b) return 1;
      const ap = a.split('/'), bp = b.split('/');
      const shared = ap.filter((s, i) => s === bp[i]).length;
      return shared / Math.max(ap.length, bp.length);
    }

    let groups = files.map(e => [e]);
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const maxSim = Math.max(...groups[i].flatMap(a =>
            groups[j].map(b => similarity(a.path, b.path))
          ));
          if (maxSim >= threshold) {
            groups[i] = [...groups[i], ...groups[j]];
            groups.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }

    const finalGroups = groups.flatMap(g => chunkBy(g, maxGroup));

    return finalGroups.flatMap(entries => {
      if (entries.length < minFiles) {
        return entries.map(e => {
          const raw = opts.lang === 'ko' ? e.msgKo : e.msgEn;
          return buildResult(cfg, [e.path], e.tag, raw, null, opts);
        });
      }
      const tag = dominantTag(entries);
      const paths = entries.map(e => e.path.split('/'));
      const commonParts = paths[0].filter((p, i) => paths.every(pp => pp[i] === p));
      const groupName = commonParts.length > 1 ? commonParts[commonParts.length - 1] : 'src';
      const groupMsg = opts.lang === 'ko'
        ? `유사 파일 묶음: ${groupName}`
        : `Group similar: ${groupName}`;
      const bodyLines = entries.map(e => opts.lang === 'ko' ? e.msgKo : e.msgEn);
      return [buildResult(cfg, entries.map(e => e.path), tag, groupMsg, bodyLines, opts)];
    });
  }

  return [];
}

export function computeFileGroups(cfg) {
  const files = getEffectiveFiles(cfg);
  const mode = cfg.grouping?.mode ?? 'per-file';
  const minFiles = cfg.grouping?.minFilesPerGroup ?? 2;
  const depth    = cfg.grouping?.directoryDepth   ?? 1;
  const threshold = cfg.grouping?.threshold       ?? 0.6;
  const maxGroup  = cfg.grouping?.maxGroupSize     ?? 10;

  const map = new Map();

  if (mode === 'per-file' || mode === 'none') {
    files.forEach((e, i) => map.set(e.path, i));
    return map;
  }

  if (mode === 'by-tag') {
    const tagMap = {};
    files.forEach(e => { (tagMap[e.tag] = tagMap[e.tag] ?? []).push(e); });
    let gi = 0;
    Object.entries(tagMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([, entries]) => {
      if (entries.length < minFiles) {
        entries.forEach(e => { map.set(e.path, gi++); });
      } else {
        entries.forEach(e => map.set(e.path, gi));
        gi++;
      }
    });
    return map;
  }

  if (mode === 'by-directory') {
    const dirMap = {};
    files.forEach(e => {
      const key = getDirKey(e.path, depth);
      (dirMap[key] = dirMap[key] ?? []).push(e);
    });
    let gi = 0;
    Object.entries(dirMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([, entries]) => {
      if (entries.length < minFiles) {
        entries.forEach(e => { map.set(e.path, gi++); });
      } else {
        entries.forEach(e => map.set(e.path, gi));
        gi++;
      }
    });
    return map;
  }

  if (mode === 'by-similarity') {
    function similarity(a, b) {
      if (a === b) return 1;
      const ap = a.split('/'), bp = b.split('/');
      const shared = ap.filter((s, i) => s === bp[i]).length;
      return shared / Math.max(ap.length, bp.length);
    }
    let groups = files.map(e => [e]);
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const maxSim = Math.max(...groups[i].flatMap(a =>
            groups[j].map(b => similarity(a.path, b.path))
          ));
          if (maxSim >= threshold) {
            groups[i] = [...groups[i], ...groups[j]];
            groups.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
    const finalGroups = groups.flatMap(g => chunkBy(g, maxGroup));
    let gi = 0;
    finalGroups.forEach(entries => {
      if (entries.length < minFiles) {
        entries.forEach(e => { map.set(e.path, gi++); });
      } else {
        entries.forEach(e => map.set(e.path, gi));
        gi++;
      }
    });
    return map;
  }

  return map;
}

export function describeTagExample(cfg) {
  if (cfg.tags?.enabled === false) return '(태그 비활성화)';
  return coreDescribeTagExample(cfg, 'src/auth/login.js');
}
