import { ENTRY_SEPARATOR } from '../constants.js';
import { describeTagExample } from '../tags/render.js';
import { filteredPathTagEntries } from './plan-shared.js';

function describePlanConstraints(cfg) {
  const g = cfg.grouping ?? {};
  const minFiles = Number.isFinite(g.minFilesPerGroup) ? g.minFilesPerGroup : 2;
  const lines = [
    'Grouping constraints:',
    `- mode: ${g.mode ?? 'by-similarity'} (intent-based — you decide partitions)`,
    `- minFilesPerGroup: ${g.minFilesPerGroup ?? 2} (groups smaller than this are allowed only when intent differs)`,
    `- threshold reference: ${g.threshold ?? 0.6} (for similar path/intent clusters)`,
    `- markdownSameDirSimilarity: ${g.markdownSameDirSimilarity ?? 0.55} (same-dir .md pairs score this — merge when intent matches)`,
    '',
    'Intent rules:',
    '- Group files that belong in ONE commit (same user-visible change, same release note).',
    '- Split when intent differs (e.g. packages/auth vs packages/billing, code vs unrelated docs).',
    '- Locale pairs (README.en.md + README.ko.md, CHANGELOG.en + CHANGELOG.ko) → same group when same document.',
    '- README vs CHANGELOG vs LICENSE: same group only when one release/docs sweep; otherwise separate.',
    '- NEVER duplicate a file across groups.',
    '- Order groups: foundational → features → docs/chore.',
  ];

  const pathHints = filteredPathTagEntries(cfg);
  if (pathHints.length) {
    lines.push('', 'Path → tag hints (apply when grouping):');
    for (const [pattern, tag] of pathHints) {
      lines.push(`- "${pattern}" → tag "${tag}"`);
    }
  }

  if (cfg.tags?.enabled !== false) {
    lines.push('', `Allowed tags: ${(cfg.tags?.list || []).join(', ')}`);
    lines.push(`Tag format example: ${describeTagExample(cfg)}`);
  }

  return lines.join('\n');
}

export function buildPlanPrompt({ files, cfg, diffByFile, draftPlan, extraPrompts = [] }) {
  const draftLines = (draftPlan?.groups || []).map((g, i) => {
    const tag = g.tag ? ` tag=${g.tag}` : '';
    const why = g.rationale ? ` — ${g.rationale}` : '';
    return `Draft ${i + 1}: [${g.files.join(', ')}]${tag}${why}`;
  });

  const system = [
    'You are a git commit grouping planner for acommit.',
    'Given diffs and rules, partition changed files into commit groups.',
    'Output ONLY one JSON object. No markdown fences. No commentary.',
    '',
    describePlanConstraints(cfg),
    '',
    'JSON shape:',
    JSON.stringify({
      version: 1,
      groups: [
        {
          files: ['path/a.js', 'path/b.js'],
          tag: 'feat',
          rationale: 'one-line why these files share one commit',
        },
      ],
    }, null, 2),
    '',
    'Fields:',
    '- files: non-empty array of paths (each input file exactly once)',
    '- tag: allowed tag name or null',
    '- rationale: short intent description for the message generator',
  ].join('\n');

  const diffText = files.map((f) => diffByFile?.get(f) ?? '').join('');

  const promptsSection = (Array.isArray(extraPrompts) && extraPrompts.length)
    ? ['# USER PROMPTS', ...extraPrompts.map((p) => `- ${p.text}`), '']
    : [];

  const user = [
    '# CHANGED FILES',
    files.join('\n'),
    '',
    '# HEURISTIC DRAFT (path-similarity hint — fix if wrong)',
    draftLines.length ? draftLines.join('\n') : '(none)',
    '',
    ...promptsSection,
    '# DIFFS',
    `Blocks separated by '${ENTRY_SEPARATOR}'.`,
    diffText,
    '',
    '# TASK',
    'Return the grouping JSON only.',
  ].filter(Boolean).join('\n');

  return { system, user };
}
