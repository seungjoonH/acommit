import { createTagRenderer, deriveStyleFromCaseBracket } from '../tags/render.js';
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
    threshold: 0.6,            // 0~1
    maxGroupSize: 10,
  },

  diff: {
    includeBinary: false,
    untrackedSizeLimit: 512_000,
  },

  ignore: {
    files: ["package-lock.json", "*.lock", "dist/**"],
    tagsForPaths: { "docs/**": "docs", "scripts/**": "chore" },
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
    ignore:       { ...DEFAULTS.ignore,       ...(user.ignore || {}) },
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
    if (out.tags.style === '{tag}' && out.tags.case === 'lower' && out.tags.bracket === 'none') {
      out.tags.style = '{tag}:';
    }
  }
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
  if (!Number.isFinite(g.maxGroupSize) || g.maxGroupSize < 1) g.maxGroupSize = DEFAULTS.grouping.maxGroupSize;

  if (!Number.isFinite(out.diff.untrackedSizeLimit) || out.diff.untrackedSizeLimit < 0) {
    out.diff.untrackedSizeLimit = DEFAULTS.diff.untrackedSizeLimit;
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
