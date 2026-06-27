import { CHARS_PER_TOKEN } from "../constants.js";

/* ── Grouping descriptor ── */
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
      `- directoryDepth: ${depth} (group by first ${depth} path segments)`,
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
      `- Cluster files by semantic/path similarity (threshold=${g.threshold}, maxGroupSize=${g.maxGroupSize}).`,
      "- Similarity considers file paths, filenames, and diff text tokens.",
      "- Keep groups compact; if borderline, prefer splitting to avoid mixed intent."
    );
  } else if (mode === "per-file") {
    lines.push("- Create exactly one commit per file.");
  } else if (mode === "none") {
    lines.push("- Do not create grouped commits; produce messages only (shell block still per-file).");
  }

  lines.push(
    "- The order of groups in text MUST match the order of the shell commands.",
    "- Within each group, list files in lexicographic order for reproducibility."
  );

  return lines.join("\n");
}

/* ── Tag style descriptor ── */
function describeTagStyle(cfg) {
  if (!cfg?.tags?.enabled) return "Tag prefix: DISABLED";
  const tag = (cfg.tags.list?.[0] ?? "feat");
  const rendered = typeof cfg.tags.render === "function"
    ? cfg.tags.render(tag)
    : `${tag}:`;
  const sep = cfg.tags.separator ?? " ";
  const allowed = (cfg.tags.list || []).join(", ");
  return `Tag prefix: ENABLED; allowed=[${allowed}]; example="${rendered}${sep}"`;
}

/* ── Token helpers ── */
function estimateTokens(str) {
  return Math.ceil((str?.length || 0) / CHARS_PER_TOKEN);
}

function truncateByTokens(str, maxTokens) {
  if (!str) return "";
  const maxChars = Math.max(0, Math.floor(maxTokens * CHARS_PER_TOKEN));
  if (str.length <= maxChars) return str;

  const cut = str.slice(0, maxChars);
  const anchors = [
    "\n--------------------------------------------",
    "\n[FILENAME]:",
    "\n----",
  ];
  const lastPos = anchors
    .map(a => cut.lastIndexOf(a))
    .reduce((m, v) => (v > m ? v : m), -1);

  const safe = lastPos > 0 ? cut.slice(0, lastPos) : cut;
  return `${safe}\n\n/* truncated for token budget */`;
}

/* ── System prompt (commit only) ── */
function buildSystemPrompt(config) {
  return [
    "You are a precise commit message generator.",
    `Language: ${config.message.lang}`,
    `Tone: ${config.message.tone}`,
    `Sentence style: ${config.message.style}`,
    `Lines: ${config.message.lines}`,
    `Subject guide width (hint): ~${config.message.wrap} chars`,
    describeTagStyle(config),
    `Conventional: ${config.conventional?.compatible ? "ON" : "OFF"}; scope: ${config.conventional?.scope?.enabled ? "ON" : "OFF"}`,
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
    "Do NOT include any other commands, comments, or annotations in that block."
  ].join("\n");
}

/* ── User prompt header (commit only) ── */
function buildUserHeader() {
  return [
    "# INPUT: Git-style changes (per file blocks)",
    "- Blocks start with '----' and include [FILENAME], [DIFFERENCES].",
    "- Some contents may be truncated for length.",
    "",
    "# TASK:",
    "- Generate commit message(s) that follow the rules above.",
    "- Prefer grouping logically as implied by the diffs and the grouping policy.",
    "- Use allowed tags; if tags are disabled, omit them.",
    "- Do not include code blocks unless needed for the shell commands.",
    "",
  ].join("\n");
}

/* ── Main entry ── */
export function buildPromptFromDiff(config, diffText, extraPrompts = []) {
  const budget = Math.floor(config.llm.maxPromptTokens * 0.85);
  const headerReserve = 512;
  const diffBudget = Math.max(256, budget - headerReserve);

  const sys = buildSystemPrompt(config);
  const userHeader = buildUserHeader();
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
