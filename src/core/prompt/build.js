// src/core/prompt/build.js
import { CHARS_PER_TOKEN, ENTRY_SEPARATOR } from "../constants.js";
import { describeTagExample } from "../tags/render.js";

function describeGrouping(cfg) {
  const g = cfg.grouping ?? {};
  const mode = g.mode ?? "per-file";
  const minFiles = Number.isFinite(g.minFilesPerGroup) ? g.minFilesPerGroup : 2;
  const depth = Number.isFinite(g.directoryDepth) ? g.directoryDepth : 1;

  const pathTagHints = cfg.ignore?.tagsForPaths ?? {};
  const pathHintsList = Object.entries(pathTagHints).map(
    ([pattern, tag]) => `- "${pattern}" => "${tag}"`
  );

  const lines = [
    "Grouping policy:",
    `- mode: ${mode}`,
  ];

  if (mode === "by-directory") {
    lines.push(
      `- directoryDepth: ${depth} (group by first ${depth} path segment(s))`,
      `- If a directory bucket has < minFilesPerGroup (${minFiles}), fall back to per-file commits.`
    );
  } else if (mode === "by-tag") {
    lines.push(
      "- Infer tag per file; use explicit hints first, then infer from diffs if unclear.",
      pathHintsList.length ? "- Tag hints by path pattern:" : "- No explicit path hints provided.",
      ...pathHintsList,
      `- One commit per tag bucket; if a bucket has < minFilesPerGroup (${minFiles}), fall back to per-file.`
    );
  } else if (mode === "by-similarity") {
    lines.push(
      `- Cluster files by path/filename similarity (threshold=${g.threshold}, maxGroupSize=${g.maxGroupSize}).`,
      `- If a cluster has < minFilesPerGroup (${minFiles}), fall back to per-file commits.`,
      "- Prefer splitting when intent differs."
    );
  } else if (mode === "per-file") {
    lines.push("- Create exactly one commit per file.");
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
  const entries = Object.entries(cfg.ignore?.tagsForPaths ?? {});
  if (!entries.length) return "";
  return [
    "Path → tag overrides (apply to every grouping mode):",
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

function buildSystemPrompt(config, { perGroup = false } = {}) {
  if (perGroup) {
    const example = describeTagExample(config);
    const tagPart = config.tags?.enabled === false ? '' : example;
    const sampleSubject = config.message?.lang === 'ko'
      ? `${tagPart}초기 설정 추가`
      : `${tagPart}Add initial setup`;

    const sections = [
      "You are a precise commit message generator.",
      "Generate exactly ONE commit for the file group in the user message.",
      `Language: ${config.message.lang} — subject MUST be in this language.`,
      describeMessageStyle(config),
      `Tone: ${config.message.tone}`,
      `Lines: ${config.message.lines}`,
      `Subject width: ≤ ${config.message.wrap} characters when possible.`,
      describeTagStyle(config),
      describeConventionalRules(config),
      describeEmojiRules(config),
      describePathTagRules(config),
      describeDiffRules(config),
      "",
      "Output format (strict — no markdown, no headings):",
      config.message.lines === 'multi'
        ? "Line 1: subject"
        : `Line 1: subject only (example: ${sampleSubject})`,
      ...(config.message.lines === 'multi'
        ? ["Lines 2-5: 2-4 concise bullet points"]
        : []),
      "Then exactly:",
      "git add <every file path on ONE line, space-separated>",
      `git commit -m "<subject>"`,
      "",
      "Rules:",
      "- Do not invent changes; only use provided diffs.",
      "- Do NOT use ### or markdown.",
      "- Do NOT emit one git add per file.",
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
    "- If lines=multi, output subject then 2-4 concise bullets.",
    "- Keep output in the specified language and style.",
    "",
    "At the end, include a shell block with executable git commands to apply the commits.",
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

export function buildPromptFromDiff(config, diffText, extraPrompts = [], opts = {}) {
  const { perGroup = false, groupFiles = [] } = opts;
  const budget = Math.floor(config.llm.maxPromptTokens * 0.85);
  const headerReserve = 512;
  const diffBudget = Math.max(256, budget - headerReserve);

  const sys = buildSystemPrompt(config, { perGroup });
  const userHeader = perGroup
    ? [
        "# INPUT: Git-style changes for ONE commit group",
        groupFiles.length
          ? `# Files in this group: ${groupFiles.join(', ')}`
          : '',
        `- Blocks separated by '${ENTRY_SEPARATOR}'.`,
        "- Blocks marked CONTENT OMITTED include path/metadata only — still commit those files.",
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
