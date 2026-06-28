// src/core/prompt/build.js
import { CHARS_PER_TOKEN, ENTRY_SEPARATOR } from "../constants.js";
import { describeTagExample } from "../tags/render.js";
import { resolveForcedTag } from "../ignore/match.js";

function filteredPathTagEntries(cfg) {
  const entries = Object.entries(cfg.ignore?.tagsForPaths ?? {});
  if (cfg.tags?.enabled === false) return entries;
  const allowed = new Set((cfg.tags?.list || []).map((t) => String(t).toLowerCase()));
  if (!allowed.size) return entries;
  return entries.filter(([, tag]) => allowed.has(String(tag).toLowerCase()));
}

function describeTagHeuristics(cfg) {
  if (cfg?.tags?.enabled === false) return '';
  const allowed = new Set((cfg.tags?.list || []).map((t) => String(t).toLowerCase()));
  const hints = [
    ['refactor', '- refactor: extract/move/reorganize — new module/file holding logic moved out of another file; updating imports/call sites (NOT feat, even when the extracted file is new)'],
    ['fix', '- fix: stricter validation or bug fix in-place — but if validation logic is EXTRACTED to a new module, use refactor for all related commits'],
    ['feat', '- feat: new user-facing capability or behavior (not extraction/refactoring of existing logic)'],
    ['docs', '- docs: documentation — any *.md file, docs/**; never feat for markdown-only changes'],
    ['test', '- test: test-only changes'],
    ['chore', '- chore: tooling, CI, lockfiles'],
  ];
  const lines = hints
    .filter(([tag]) => !allowed.size || allowed.has(tag))
    .map(([, line]) => line);
  if (!lines.length) {
    return 'Tag selection: use ONLY tags from the allowed list above.';
  }
  return [
    'Tag selection (use allowed tags ONLY — never invent or use unlisted tags):',
    allowed.size
      ? `- CRITICAL: allowed=[${[...allowed].join(', ')}] overrides path/file-type inference — never use an unlisted tag (e.g. docs: when only feat/fix are allowed).`
      : null,
    '- CRITICAL: code extraction (new helper/validator module + existing file imports it) → refactor on EVERY commit for that extraction (never feat/fix).',
    ...lines,
    allowed.size && !allowed.has('docs')
      ? '- docs/** or *.md paths: use feat for new content or fix for corrections (docs: is NOT allowed).'
      : null,
  ].filter(Boolean).join('\n');
}

function describeGrouping(cfg) {
  const g = cfg.grouping ?? {};
  const mode = g.mode ?? "per-file";
  const minFiles = Number.isFinite(g.minFilesPerGroup) ? g.minFilesPerGroup : 2;
  const depth = Number.isFinite(g.directoryDepth) ? g.directoryDepth : 1;

  const pathHintsList = filteredPathTagEntries(cfg).map(
    ([pattern, tag]) => `- "${pattern}" => "${tag}"`
  );

  const lines = [
    "Grouping policy:",
    `- mode: ${mode}`,
  ];

  if (mode === "by-directory") {
    lines.push(
      `- directoryDepth: ${depth} — bucket = first ${depth} path segment(s) of each [FILENAME].`,
      `- NEVER mix files from different buckets in one git add/commit (e.g. apps/admin/* and apps/storefront/* are separate).`,
      `- Put ALL files from the same bucket in ONE git add when that bucket has ≥ minFilesPerGroup (${minFiles}) files.`,
      `- Example depth 2: apps/admin/* | apps/storefront/* | libs/shared/* | tools/ci/* → separate commits; all libs/shared/** files → single commit.`,
      `- Smaller buckets (< ${minFiles} files) → per-file commits.`,
    );
  } else if (mode === "by-tag") {
    lines.push(
      "- Infer tag per file; use explicit hints first, then infer from diffs if unclear.",
      pathHintsList.length ? "- Tag hints by path pattern:" : "- No explicit path hints provided.",
      ...pathHintsList,
      `- One commit per tag bucket; if a bucket has < minFilesPerGroup (${minFiles}), fall back to per-file.`
    );
  } else if (mode === "by-similarity") {
    const mdSim = Number.isFinite(g.markdownSameDirSimilarity)
      ? g.markdownSameDirSimilarity
      : 0.55;
    lines.push(
      `- Cluster when computeFileSimilarity >= threshold (${g.threshold}).`,
      `- Similarity = max(path segments, locale pair=1.0, same-dir markdown=${mdSim}).`,
      `- Locale pairs (.en/.ko same basename) always score 1.0.`,
      `- README.md vs CHANGELOG.md vs LICENSE.md (same dir): score ${mdSim} — merge when threshold <= ${mdSim}, else separate commits.`,
      `- Set markdownSameDirSimilarity: 1 to always bundle same-dir markdown; 0 for locale-only pairing.`,
      `- clusters < minFilesPerGroup (${minFiles}) fall back to per-file.`,
      "- Split when top-level prefix or intent differs (e.g. packages/auth vs packages/billing vs docs/).",
      "- NEVER mix packages/auth, packages/billing, and docs/** paths in one git add.",
      "- packages/auth/* → ONE git add/commit for ALL auth files (never split into multiple auth commits).",
      "- Auth/login validation hardening → tag fix; billing/tax calculation corrections → tag fix; code extraction to new modules → tag refactor.",
      "- Stricter validation in existing handlers (no new module) → tag fix (not feat/refactor).",
      "- Each commit message must match ONLY the files in that group (do not describe billing changes in an auth commit).",
    );
  } else if (mode === "per-file") {
    lines.push(
      "- Create exactly one commit per file.",
      "- Emit a separate git add + git commit pair for EVERY file — never bundle multiple files in one git add.",
      "- Extract-and-wire pair (new module file + existing file imports it): tag BOTH commits refactor (never feat/fix).",
    );
  } else if (mode === "none") {
    lines.push("- Produce commit messages only; still include per-file shell commands (git add + git commit).");
  }

  lines.push(
    "- The order of groups in text MUST match the order of the shell commands.",
    "- Within each group, list files in lexicographic order for reproducibility."
  );

  return lines.join("\n");
}

function describeTagStyle(cfg) {
  if (!cfg?.tags?.enabled) return "Tag prefix: DISABLED";
  const allowed = (cfg.tags.list || []).join(", ");
  const example = describeTagExample(cfg);
  return `Tag prefix: ENABLED; allowed=[${allowed}]; example="${example}"`;
}

function describeConventionalRules(cfg) {
  const conv = cfg.conventional ?? {};
  if (!conv.compatible) return "Conventional Commits: OFF";
  const scope = conv.scope ?? {};
  const lines = ["Conventional Commits: ON — use type(scope) subject format when scope is enabled."];
  if (scope.enabled) {
    lines.push(
      "Scope: ON — include (scope) between type and separator, e.g. feat(auth): message",
      scope.inferFromPath !== false
        ? "- Infer scope from path: strip leading src/, use first directory segment. Omit scope when it equals the tag."
        : "- Scope must be chosen from diff context."
    );
  } else {
    lines.push("Scope: OFF — use type only, e.g. feat: message");
  }
  return lines.join("\n");
}

function describePathTagRules(cfg) {
  const entries = filteredPathTagEntries(cfg);
  if (!entries.length) return "";
  return [
    "Path → tag overrides (apply to every grouping mode; must use allowed tags only):",
    ...entries.map(([pattern, tag]) => `- "${pattern}" => tag "${tag}"`),
  ].join("\n");
}

function describeDiffRules(cfg) {
  const omit = cfg.diff?.omitContent ?? [];
  const skip = cfg.diff?.skip ?? [];
  const lines = [];
  if (omit.length) {
    lines.push(
      "Diff content omitted (metadata only — still include in git add/commit):",
      ...omit.map((p) => `- ${p}`),
      "- Infer commit message from path/filename and metadata only; do not invent line-level changes.",
    );
  }
  if (skip.length) {
    lines.push(
      "Fully excluded from acommit (no commit message or git commands):",
      ...skip.map((p) => `- ${p}`),
    );
  }
  if (!lines.length) return "";
  return lines.join("\n");
}

function describeEmojiRules(cfg) {
  const emoji = cfg.message?.emoji;
  if (!emoji?.enabled) return "Emoji prefix: OFF";
  const map = emoji.map ?? {};
  const samples = Object.entries(map).slice(0, 5).map(([k, v]) => `${k}→${v}`).join(", ");
  return [
    "Emoji prefix: ON — prepend configured emoji before the tag prefix.",
    samples ? `Custom map: ${samples}` : "Use default emoji per tag when map entry missing.",
  ].join("\n");
}

function estimateTokens(str) {
  return Math.ceil((str?.length || 0) / CHARS_PER_TOKEN);
}

function truncateByTokens(str, maxTokens) {
  if (!str) return "";
  const maxChars = Math.max(0, Math.floor(maxTokens * CHARS_PER_TOKEN));
  if (str.length <= maxChars) return str;

  const cut = str.slice(0, maxChars);
  const anchors = [
    `\n${ENTRY_SEPARATOR}`,
    "\n[FILENAME]:",
  ];
  const lastPos = anchors
    .map(a => cut.lastIndexOf(a))
    .reduce((m, v) => (v > m ? v : m), -1);

  const safe = lastPos > 0 ? cut.slice(0, lastPos) : cut;
  return `${safe}\n\n/* truncated for token budget */`;
}

function describeMessageStyle(config) {
  const lang = config.message?.lang ?? 'ko';
  const style = config.message?.style ?? 'verb';
  if (lang === 'ko') {
    if (style === 'declarative') {
      return 'Sentence style: Korean declarative (~함), e.g. "초기 설정을 추가함". Do NOT use English.';
    }
    return 'Sentence style: Korean terse verb/noun, e.g. "초기 설정 추가". Do NOT use English.';
  }
  if (style === 'past') {
    return 'Sentence style: English past tense, e.g. "Added initial setup".';
  }
  return 'Sentence style: English imperative, e.g. "Add initial setup".';
}

function sampleSubjectLine(config, tagPart = '') {
  const lang = config.message?.lang ?? 'ko';
  const style = config.message?.style ?? 'verb';
  if (lang === 'ko') {
    if (style === 'declarative') {
      return `${tagPart}초기 설정을 추가함`;
    }
    return `${tagPart}초기 설정 추가`;
  }
  if (style === 'past') {
    return `${tagPart}Added initial setup`;
  }
  return `${tagPart}Add initial setup`;
}

function describeStyleEnforcement(config) {
  const lang = config.message?.lang ?? 'ko';
  const style = config.message?.style ?? 'verb';
  if (lang === 'ko' && style === 'declarative') {
    return '- Korean declarative: subject MUST end with ~함, ~습니다, ~됨, or ~임 — never verb-only endings like "추가" without those suffixes.';
  }
  if (lang === 'en' && style === 'past') {
    return '- English past: subject MUST use past tense (e.g. Added, Fixed, Updated).';
  }
  if (lang === 'en' && style === 'imperative') {
    return '- English imperative: subject MUST use base verb form (e.g. Add, Fix, Update) — not past tense.';
  }
  return null;
}

function buildSystemPrompt(config, { perGroup = false } = {}) {
  if (perGroup) {
    const example = describeTagExample(config);
    const tagPart = config.tags?.enabled === false ? '' : example;
    const sampleSubject = sampleSubjectLine(config, tagPart);
    const styleRule = describeStyleEnforcement(config);

    const sections = [
      "You are a precise commit message generator.",
      "Generate exactly ONE commit for the file group in the user message.",
      `Language: ${config.message.lang} — subject MUST be in this language.`,
      describeMessageStyle(config),
      `Tone: ${config.message.tone}`,
      `Lines: ${config.message.lines}`,
      `Subject width: ≤ ${config.message.wrap} characters when possible.`,
      describeTagStyle(config),
      describeTagHeuristics(config),
      describeConventionalRules(config),
      describeEmojiRules(config),
      describePathTagRules(config),
      describeDiffRules(config),
      "",
      "Output format (strict — no markdown, no headings):",
      config.message.lines === 'multi'
        ? `Line 1: subject (example: ${sampleSubject})`
        : `Line 1: subject only (example: ${sampleSubject})`,
      ...(config.message.lines === 'multi'
        ? [
          "Lines 2-5: 2-4 concise bullet points (use - bullets only).",
          "Do NOT use per-file changelog headers like \"src/foo.js:\" in the body.",
        ]
        : []),
      "Then exactly:",
      "git add <every file path on ONE line, space-separated>",
      config.message.lines === 'multi'
        ? 'git commit -m "<subject>\\n\\n- bullet1\\n- bullet2"'
        : `git commit -m "<subject>"`,
      "",
      "Rules:",
      "- Grounding: base the message ONLY on [DIFFERENCES] (+/- hunk lines) for this group.",
      "- Do NOT infer changes from the file path, parent directories, filename, or extension (e.g. k8s/, migrations/, seed/, .yaml, .sql).",
      "- Name added/changed functions, classes, or logic from the hunk (e.g. parseDate, Widget, render) when they appear in +/- lines.",
      "- Do not invent changes; only use provided diffs.",
      styleRule,
      "- Do NOT use ### or markdown.",
      "- Do NOT emit one git add per file.",
      "- Shell lines MUST start with `git add` or `git commit` — NEVER output a bare file path.",
      "- No commentary before or after the block.",
    ].filter(Boolean);

    return sections.join("\n");
  }

  const sections = [
    "You are a precise commit message generator.",
    `Language: ${config.message.lang}`,
    describeMessageStyle(config),
    `Tone: ${config.message.tone}`,
    `Sentence style: ${config.message.style}`,
    `Lines: ${config.message.lines}`,
    `Subject width: keep subject ≤ ${config.message.wrap} characters when possible.`,
    describeTagStyle(config),
    describeTagHeuristics(config),
    describeConventionalRules(config),
    describeEmojiRules(config),
    describePathTagRules(config),
    describeDiffRules(config),
    "",
    describeGrouping(config),
    "",
    "Rules:",
    "- Do not invent changes; only use provided diffs.",
    "- If lines=single, output only one subject line.",
    "- If lines=multi, output subject then 2-4 concise bullets starting with `-` (no plain paragraphs).",
    config.message?.lines === 'multi'
      ? '- For lines=multi, bullets MUST use `-` prefix in both narrative and git commit -m (\\n between subject and bullets).'
      : null,
    describeStyleEnforcement(config),
    "- Keep output in the specified language and style.",
    "",
    "At the end, include a shell block wrapped in ```bash ... ``` with executable git commands.",
    "The commands must be copy-paste ready and grouped logically by the messages you produce.",
    "The order of groups in the shell block MUST match the message groups.",
    "The shell block MUST include only 'git add …' and 'git commit -m …' lines.",
    "Do NOT include any other commands, comments, or annotations in that block.",
  ].filter(Boolean);

  return sections.join("\n");
}

function buildUserHeader() {
  return [
    "# INPUT: Git-style changes (per file blocks)",
    `- Blocks are separated by '${ENTRY_SEPARATOR}' and include [FILENAME], [DIFFERENCES].`,
    "- Some contents may be truncated for length.",
    "- Blocks marked CONTENT OMITTED include path/metadata only — still commit those files.",
    "",
    "# TASK:",
    "- Generate commit message(s) that follow the rules above.",
    "- Prefer grouping logically as implied by the diffs and the grouping policy.",
    "- Use allowed tags; if tags are disabled, omit them.",
    "- Do not include code blocks unless needed for the shell commands.",
    "",
  ].join("\n");
}

function describeGroupHints(config, groupFiles, planGroup) {
  const lines = [];
  if (planGroup?.rationale) {
    lines.push(`# GROUP INTENT (from plan): ${planGroup.rationale}`);
  }
  if (planGroup?.tag && config.tags?.enabled !== false) {
    lines.push(`# REQUIRED TAG (from plan): ${planGroup.tag}:`);
  } else if (groupFiles?.length && config.tags?.enabled !== false) {
    const tags = groupFiles.map((f) => resolveForcedTag(f, config.ignore?.tagsForPaths));
    const forced = tags.filter(Boolean);
    const unique = [...new Set(forced)];
    if (unique.length === 1) {
      lines.push(`# REQUIRED TAG: ${unique[0]}: (forced by path rules for every file in this group)`);
    }
  }
  return lines.join('\n');
}

export function buildPromptFromDiff(config, diffText, extraPrompts = [], opts = {}) {
  const { perGroup = false, groupFiles = [], planGroup = null } = opts;
  const budget = Math.floor(config.llm.maxPromptTokens * 0.85);
  const headerReserve = 512;
  const diffBudget = Math.max(256, budget - headerReserve);

  const sys = buildSystemPrompt(config, { perGroup });
  const groupHints = perGroup ? describeGroupHints(config, groupFiles, planGroup) : '';
  const userHeader = perGroup
    ? [
        "# INPUT: Git-style changes for ONE commit group",
        "Grouping is already fixed — generate exactly one commit for the files below; do not split or merge.",
        groupFiles.length
          ? `# Files in this group: ${groupFiles.join(', ')}`
          : '',
        groupHints,
        `- Blocks separated by '${ENTRY_SEPARATOR}'.`,
        "- Blocks marked CONTENT OMITTED include path/metadata only — still commit those files.",
        "- Describe ONLY what the [DIFFERENCES] hunk shows — never guess from the path or filename.",
        "",
        "# TASK: Generate exactly one commit (subject + shell lines).",
        "",
      ].filter(Boolean).join("\n")
    : buildUserHeader();
  const trimmedDiff = truncateByTokens(diffText, diffBudget);

  const promptsSection = (Array.isArray(extraPrompts) && extraPrompts.length)
    ? ["# ADDITIONAL PROMPTS (user-provided):", ...extraPrompts.map(p => `- ${p.text}`), ""]
    : [];

  const sections = [
    userHeader,
    promptsSection.join('\n'),
    trimmedDiff,
  ].filter(Boolean);

  const user = sections.join("\n");
  const approxTokens = estimateTokens(sys) + estimateTokens(user);

  return { system: sys, user, approxTokens };
}
