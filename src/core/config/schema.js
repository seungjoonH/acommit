export const DEFAULTS = {
  llm: {
    provider: "gemini",
    model: "gemini-2.5-flash",
    maxPromptTokens: 200_000,
    maxOutputTokens: 4_000,
  },
  prompts: [],

  message: {
    // 내부 표준 키는 lang. YAML에서는 language를 받아 매핑함.
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
    separator: " ",
    render: null,              // 함수 주입 가능. 없으면 아래 case/bracket 규칙 사용
    case: "lower",             // "lower" | "upper" | "capitalize"
    bracket: "none",           // "none" | "square" | "round"
  },

  grouping: {
    // per-file | by-tag | by-directory | by-similarity | none
    mode: "per-file",
    // by-directory 전용
    directoryDepth: 1,
    // by-tag / by-directory 전용
    minFilesPerGroup: 2,
    // by-similarity 전용
    threshold: 0.6,            // 0~1
    maxGroupSize: 10,
  },

  diff: {
    includeBinary: false,
    untrackedSizeLimit: 512_000,
    context: 3,
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

  // ── message.language -> message.lang 매핑
  if (user?.message?.language && !user?.message?.lang) {
    out.message.lang = String(user.message.language).trim() || DEFAULTS.message.lang;
  }

  // ── message.lines 유효성
  if (!["single", "multi"].includes(out.message.lines)) out.message.lines = "single";

  // ── tags.render가 없으면 case/bracket 규칙으로 기본 렌더 정의
  if (typeof out.tags.render !== "function") {
    const toCase = (s) => {
      if (out.tags.case === "upper") return s.toUpperCase();
      if (out.tags.case === "capitalize") return s.charAt(0).toUpperCase() + s.slice(1);
      return s.toLowerCase();
    };
    const wrap = (s) => {
      if (out.tags.bracket === "square") return `[${s}]`;
      if (out.tags.bracket === "round")  return `(${s})`;
      return s;
    };
    out.tags.render = (tag) => {
      const t = wrap(toCase(tag));
      // bracket이 없는 경우에만 콜론 자동 부착(관례)
      const needsColon = out.tags.bracket === "none";
      const suffix = needsColon ? ":" : "";
      return `${t}${suffix}`;
    };
  }
  if (out.tags.separator == null) out.tags.separator = " ";

  // ── grouping 유효성
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
      out.llm.model = process.env.OPENAI_MODEL || null;
    } else if (provider === "gemini") {
      out.llm.model = process.env.GEMINI_MODEL || DEFAULTS.llm.model;
    }
  }

  return out;
}
