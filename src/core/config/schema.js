// src/core/config/schema.js

export const DEFAULTS = {
  llm: { maxPromptTokens: 120_000 },
  message: { lang: "ko", tone: "concise", style: "verb", lines: "single", wrap: 72 },
  tags: {
    enabled: true,
    list: ["feat","fix","docs","chore","refactor","test","perf","build","ci"],
    separator: " ",
    render: null,
    case: "lower",       // "lower" | "upper" | "capitalize"
    bracket: "none",     // "none" | "square" | "round"
  },
  conventional: { compatible: false, scope: { enabled: false } },
};

function mergeDefaults(user = {}) {
  return {
    llm:          { ...DEFAULTS.llm,          ...(user.llm || {}) },
    message:      { ...DEFAULTS.message,      ...(user.message || {}) },
    tags:         { ...DEFAULTS.tags,         ...(user.tags || {}) },
    conventional: { ...DEFAULTS.conventional, ...(user.conventional || {}) },
  };
}

export function normalize(user = {}) {
  const out = mergeDefaults(user);

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
      const needsColon = out.tags.bracket === "none";
      const suffix = needsColon ? ":" : "";
      return `${t}${suffix}`;
    };
  }

  if (out.tags.separator == null) out.tags.separator = " ";
  if (!["single", "multi"].includes(out.message.lines)) out.message.lines = "single";

  return out;
}