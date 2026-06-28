import { createTagRenderer, deriveStyleFromCaseBracket, migrateLegacyTagFormat } from '../tags/render.js';
import { coerceMessageStyle } from '../message/styles.js';
import { env } from '../../utils/env.js';

export const DEFAULTS = {
  llm: {
    provider: "gemini",
    model: "gemini-2.5-flash",
    maxPromptTokens: 200_000,
    maxOutputTokens: 4_000,
  },
  prompts: [],

  message: {
    // Language alias mapping
    lang: "ko",
    tone: "concise",           // "concise" | "detailed"
    style: "verb",             // "verb" | "declarative" | "imperative" | "past"
    lines: "single",           // "single" | "multi"
    wrap: 72,
    emoji: { enabled: false, map: {} },
  },

  tags: {
    enabled: true,
    list: ["feat","fix","docs","chore","refactor","test","perf","build","ci"],
    separator: ": ",
    render: null,
    case: "lower",
    bracket: "none",
  },

  grouping: {
    // per-file | by-tag | by-directory | by-similarity | none
    mode: "per-file",
    // Directory grouping settings
    directoryDepth: 1,
    // Tag/directory grouping thresholds
    minFilesPerGroup: 2,
    // Similarity grouping thresholds
    threshold: 0.6,            // 0~1 — merge when computeFileSimilarity >= threshold
    // Same-dir .md with different basenames (README vs CHANGELOG): similarity score (0=off, 1=always cluster)
    markdownSameDirSimilarity: 0.55,
  },

  diff: {
    includeBinary: false,
    untrackedSizeLimit: 512_000,
    // Still grouped + git add; only diff body omitted from LLM input
    omitContent: [
      "**/package-lock.json",
      "package-lock.json",
      "*.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
      "**/*.min.js",
      "**/*.map",
    ],
    // Fully excluded from acommit (no commit message)
    skip: ["dist/**"],
  },

  ignore: {
    tagsForPaths: {
      "docs/**": "docs",
      "*.md": "docs",
      "scripts/**": "chore",
      "**/package-lock.json": "chore",
      "*.lock": "chore",
      "pnpm-lock.yaml": "chore",
      "yarn.lock": "chore",
    },
  },

  conventional: {
    compatible: false,
    scope: { enabled: false, inferFromPath: true },
  },
};

function mergeDefaults(user = {}) {
  return {
    llm:          { ...DEFAULTS.llm,          ...(user.llm || {}) },
    message:      { ...DEFAULTS.message,      ...(user.message || {}) },
    prompts:      user.prompts || DEFAULTS.prompts,
    tags:         { ...DEFAULTS.tags,         ...(user.tags || {}) },
    grouping:     { ...DEFAULTS.grouping,     ...(user.grouping || {}) },
    diff:         { ...DEFAULTS.diff,         ...(user.diff || {}) },
    ignore: {
      ...DEFAULTS.ignore,
      ...(user.ignore || {}),
      tagsForPaths: {
        ...DEFAULTS.ignore.tagsForPaths,
        ...(user.ignore?.tagsForPaths || {}),
      },
    },
    conventional: { ...DEFAULTS.conventional, ...(user.conventional || {}) },
  };
}

export function normalize(user = {}) {
  const out = mergeDefaults(user);

  // message.language remapping
  if (user?.message?.language && !user?.message?.lang) {
    out.message.lang = String(user.message.language).trim() || DEFAULTS.message.lang;
  }

  // message.lines validation
  if (!["single", "multi"].includes(out.message.lines)) out.message.lines = "single";

  out.message.style = coerceMessageStyle(out.message.style, out.message.lang);

  // Tag renderer — same logic as rules UI preview (tags/render.js)
  const userTags = user?.tags ?? {};
  const hasStyleKey = Object.prototype.hasOwnProperty.call(userTags, 'style');
  if (!hasStyleKey) {
    out.tags.style = deriveStyleFromCaseBracket(out.tags.case, out.tags.bracket);
  }
  // Legacy: colon baked into style while separator also has colon → feat::
  [out.tags.style, out.tags.separator] = migrateLegacyTagFormat(out.tags.style, out.tags.separator);
  if (typeof out.tags.render !== "function") {
    out.tags.render = createTagRenderer(out.tags);
  }
  if (out.tags.separator == null) out.tags.separator = ": ";

  // Grouping validation
  const modes = new Set(["per-file","by-tag","by-directory","by-similarity","none"]);
  if (!modes.has(out.grouping.mode)) out.grouping.mode = "per-file";

  const g = out.grouping;
  if (!Number.isFinite(g.directoryDepth) || g.directoryDepth < 1) g.directoryDepth = 1;
  if (!Number.isFinite(g.minFilesPerGroup) || g.minFilesPerGroup < 1) g.minFilesPerGroup = 2;
  if (!Number.isFinite(g.threshold)) g.threshold = DEFAULTS.grouping.threshold;
  if (g.threshold < 0) g.threshold = 0;
  if (g.threshold > 1) g.threshold = 1;
  if (!Number.isFinite(g.markdownSameDirSimilarity)) {
    g.markdownSameDirSimilarity = DEFAULTS.grouping.markdownSameDirSimilarity;
  }
  if (g.markdownSameDirSimilarity < 0) g.markdownSameDirSimilarity = 0;
  if (g.markdownSameDirSimilarity > 1) g.markdownSameDirSimilarity = 1;
  delete g.maxGroupSize;

  if (!Number.isFinite(out.diff.untrackedSizeLimit) || out.diff.untrackedSizeLimit < 0) {
    out.diff.untrackedSizeLimit = DEFAULTS.diff.untrackedSizeLimit;
  }

  if (!Array.isArray(out.diff.omitContent)) {
    out.diff.omitContent = [...DEFAULTS.diff.omitContent];
  }
  if (!Array.isArray(out.diff.skip)) {
    out.diff.skip = [...DEFAULTS.diff.skip];
  }

  // Legacy: ignore.files → omitContent (locks) or skip (dist/build output)
  const legacyIgnore = user?.ignore?.files;
  if (Array.isArray(legacyIgnore) && legacyIgnore.length) {
    const skipLike = (p) => p === "dist/**" || p.startsWith("dist/") || p.includes("/dist/**");
    for (const pattern of legacyIgnore) {
      if (skipLike(pattern)) {
        if (!out.diff.skip.includes(pattern)) out.diff.skip.push(pattern);
      } else if (!out.diff.omitContent.includes(pattern)) {
        out.diff.omitContent.push(pattern);
      }
    }
  }

  const hasUserModel = Boolean(user?.llm && Object.prototype.hasOwnProperty.call(user.llm, "model"));
  if (!hasUserModel) {
    const provider = (out.llm?.provider || "").toLowerCase();
    if (provider === "openai") {
      out.llm.model = env('OPENAI_MODEL') || null;
    } else if (provider === "openrouter") {
      out.llm.model = env('OPENROUTER_MODEL') || "google/gemini-2.5-flash";
    } else if (provider === "gemini") {
      out.llm.model = env('GEMINI_MODEL') || DEFAULTS.llm.model;
    }
  }

  return out;
}
