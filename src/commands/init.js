import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { normalize, DEFAULTS } from '../core/config/schema.js';
import { defaultStyleForMessageLang } from '../core/message/styles.js';
import { writeLocale, normalizeLocale } from '../core/locale.js';
import { selectOption, createTuiSession, pc, clack } from '../ui/tui.js';
import { pickLlmConfig } from '../ui/llm-pick.js';
import { initStrings, LOCALE_PICK } from '../ui/init-i18n.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATHS = {
  ko: path.resolve(__dirname, '../../samples/config/commit.ko.yml'),
  en: path.resolve(__dirname, '../../samples/config/commit.en.yml'),
};

function toSerializable(cfg) {
  const out = {
    llm: cfg.llm,
    message: cfg.message,
    prompts: cfg.prompts ?? [],
    tags: { ...cfg.tags },
    grouping: cfg.grouping,
    diff: cfg.diff,
    ignore: cfg.ignore,
    conventional: cfg.conventional,
  };
  delete out.tags.render;
  return out;
}

async function ensureWorkspace(acomDir) {
  await fs.mkdir(path.join(acomDir, 'results', 'commits'), { recursive: true });
  const gitkeep = path.join(acomDir, 'results', '.gitkeep');
  try {
    await fs.access(gitkeep);
  } catch {
    await fs.writeFile(gitkeep, '# Generated commit drafts go in results/commits/\n', 'utf8');
  }
}

function gitignoreEntry(choice) {
  if (choice === 'results') return '.acommit/results/';
  if (choice === 'all') return '.acommit/';
  return null;
}

function summarizeCreated({ wroteRules, gitignoreChoice }) {
  const lines = ['.acommit/locale', '.acommit/results/commits/', '.acommit/results/.gitkeep'];
  if (wroteRules) lines.push('.acommit/rules.yml');
  const entry = gitignoreEntry(gitignoreChoice);
  if (entry) lines.push(`.gitignore (+ ${entry})`);
  return lines;
}

async function readGitignore(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  try {
    return { path: gitignorePath, content: await fs.readFile(gitignorePath, 'utf8') };
  } catch {
    return { path: gitignorePath, content: '' };
  }
}

async function applyGitignoreChoice(cwd, choice) {
  const entry = gitignoreEntry(choice);
  if (!entry) return false;

  const { path: gitignorePath, content } = await readGitignore(cwd);
  if (content.includes(entry)) return false;

  const updated = content.trimEnd() + (content.length ? '\n' : '') + `${entry}\n`;
  await fs.writeFile(gitignorePath, updated, 'utf8');
  return true;
}

function pick(tui, { step, subtitle, ...rest }) {
  return selectOption({
    session: tui,
    step,
    subtitle,
    ...rest,
  });
}

async function askLocale(tui, localeHint) {
  return pick(tui, {
    ...LOCALE_PICK,
    initialValue: normalizeLocale(localeHint),
  });
}

async function askSetupMode(tui, t) {
  return pick(tui, {
    step: t.setupMode.step,
    subtitle: t.setupMode.subtitle,
    options: t.setupMode.options,
  });
}

async function askRulesOptions(tui, t) {
  const s = t.messageLang;
  const messageLang = await pick(tui, {
    step: s.step,
    subtitle: s.subtitle,
    options: s.options,
    initialValue: DEFAULTS.message.lang,
  });
  if (!messageLang) return null;

  const messageLines = await pick(tui, {
    step: t.messageLines.step,
    subtitle: t.messageLines.subtitle,
    options: t.messageLines.options,
    initialValue: 'single',
  });
  if (!messageLines) return null;

  const styleSection = messageLang === 'en' ? t.messageStyleEn : t.messageStyleKo;
  const messageStyle = await pick(tui, {
    step: styleSection.step,
    subtitle: styleSection.subtitle,
    options: styleSection.options,
    initialValue: defaultStyleForMessageLang(messageLang),
  });
  if (!messageStyle) return null;

  const groupingMode = await pick(tui, {
    step: t.grouping.step,
    subtitle: t.grouping.subtitle,
    options: t.grouping.options,
    initialValue: 'by-similarity',
  });
  if (!groupingMode) return null;

  const tagsEnabled = await pick(tui, {
    step: t.tags.step,
    subtitle: t.tags.subtitle,
    options: t.tags.options,
    initialValue: 'yes',
  });
  if (!tagsEnabled) return null;

  const llm = await pickLlmConfig({
    session: tui,
    step: t.llm.step,
    labels: t.llmPick,
    current: { provider: DEFAULTS.llm.provider, model: DEFAULTS.llm.model },
  });
  if (!llm) return null;

  const conventional = await pick(tui, {
    step: t.conventional.step,
    subtitle: t.conventional.subtitle,
    options: t.conventional.options,
    initialValue: 'no',
  });
  if (!conventional) return null;

  let scopeEnabled = false;
  if (conventional === 'yes') {
    const scope = await pick(tui, {
      step: t.scope.step,
      subtitle: t.scope.subtitle,
      options: t.scope.options,
      initialValue: 'no',
    });
    if (!scope) return null;
    scopeEnabled = scope === 'yes';
  }

  return normalize({
    message: {
      lang: messageLang,
      style: messageStyle,
      lines: messageLines,
      tone: DEFAULTS.message.tone,
      wrap: DEFAULTS.message.wrap,
      emoji: DEFAULTS.message.emoji,
    },
    tags: {
      enabled: tagsEnabled === 'yes',
      list: DEFAULTS.tags.list,
      style: '{tag}:',
      separator: ': ',
      case: 'lower',
      bracket: 'none',
    },
    grouping: {
      ...DEFAULTS.grouping,
      mode: groupingMode,
    },
    llm: {
      provider: llm.provider,
      model: llm.model,
      maxPromptTokens: DEFAULTS.llm.maxPromptTokens,
      maxOutputTokens: DEFAULTS.llm.maxOutputTokens,
    },
    conventional: {
      compatible: conventional === 'yes',
      scope: { enabled: scopeEnabled, inferFromPath: true },
    },
    diff: DEFAULTS.diff,
    ignore: DEFAULTS.ignore,
    prompts: [],
  });
}

async function askGitignoreChoice(tui, t) {
  return pick(tui, {
    step: t.gitignore.step,
    subtitle: t.gitignore.subtitle,
    options: t.gitignore.options,
    initialValue: 'results',
  });
}

async function writeRulesFromTemplate(locale, target) {
  const templatePath = TEMPLATE_PATHS[normalizeLocale(locale)] || TEMPLATE_PATHS.ko;
  const content = await fs.readFile(templatePath, 'utf8');
  await fs.writeFile(target, content, 'utf8');
}

async function writeRulesFromConfig(cfg, target) {
  const yamlStr = YAML.stringify(toSerializable(cfg));
  await fs.writeFile(target, yamlStr, 'utf8');
}

export async function initConfig({
  lang: localeHint = 'ko',
  cwd = process.cwd(),
  configure,
  skipRules,
  gitignore,
  nonInteractive = false,
} = {}) {
  const acomDir = path.join(cwd, '.acommit');
  const target = path.join(acomDir, 'rules.yml');

  try {
    await fs.access(target);
    logger.info(`[acommit] .acommit/rules.yml already exists at ${target}`);
    logger.info('[acommit] Delete it first or edit with `acommit rules`.');
    return;
  } catch { /* ok */ }

  const interactive = process.stdin.isTTY && !nonInteractive
    && configure == null && skipRules == null && gitignore == null;

  let setupMode = 'skip';
  let cfg = null;
  let gitignoreChoice = 'results';
  let tui = null;
  let locale = normalizeLocale(localeHint);

  if (interactive) {
    tui = createTuiSession('acommit setup');
    locale = normalizeLocale(await askLocale(tui, localeHint));
    if (!locale) {
      tui.cancel('Setup cancelled.');
      return;
    }
    const t = initStrings(locale);

    setupMode = await askSetupMode(tui, t);
    if (!setupMode) {
      tui.cancel(t.cancel);
      return;
    }

    if (setupMode === 'configure') {
      cfg = await askRulesOptions(tui, t);
      if (!cfg) {
        tui.cancel(t.cancel);
        return;
      }
    }

    gitignoreChoice = await askGitignoreChoice(tui, t);
    if (!gitignoreChoice) {
      tui.cancel(t.cancel);
      return;
    }

    await ensureWorkspace(acomDir);
    await writeLocale(cwd, locale);

    const wroteRules = !skipRules;
    if (setupMode === 'configure' && cfg) {
      await writeRulesFromConfig(cfg, target);
    } else if (wroteRules) {
      await writeRulesFromTemplate(locale, target);
    }

    const gitignoreUpdated = await applyGitignoreChoice(cwd, gitignoreChoice);
    const created = summarizeCreated({ wroteRules, gitignoreChoice });
    if (!gitignoreUpdated && gitignoreEntry(gitignoreChoice)) {
      created.pop();
      created.push(t.gitignoreAlready(gitignoreEntry(gitignoreChoice)));
    }

    const createdText = created.map((line) => `  ${line}`).join('\n');
    clack.log.success(`${t.created}\n${createdText}`);
    if (setupMode === 'skip' && wroteRules) {
      clack.log.info(t.defaultRulesHint);
    }
    tui.finish(
      setupMode === 'configure'
        ? pc.green(t.finishConfigured)
        : pc.dim(t.finishDefaults),
    );
    return;
  } else {
    if (skipRules) {
      setupMode = 'skip';
    } else if (configure) {
      setupMode = 'configure';
      cfg = normalize({
        message: { lang: DEFAULTS.message.lang },
        grouping: { mode: 'by-similarity' },
      });
    } else {
      setupMode = 'skip';
    }
    gitignoreChoice = gitignore ?? 'results';
    locale = normalizeLocale(localeHint);
  }

  await ensureWorkspace(acomDir);
  await writeLocale(cwd, locale);

  const wroteRules = !skipRules;
  if (setupMode === 'configure' && cfg) {
    await writeRulesFromConfig(cfg, target);
  } else if (wroteRules) {
    await writeRulesFromTemplate(locale, target);
  }

  const gitignoreUpdated = await applyGitignoreChoice(cwd, gitignoreChoice);
  const created = summarizeCreated({ wroteRules, gitignoreChoice });
  if (!gitignoreUpdated && gitignoreEntry(gitignoreChoice)) {
    created.pop();
    created.push(`.gitignore (already had ${gitignoreEntry(gitignoreChoice)})`);
  }

  for (const line of created) {
    logger.info(`[acommit] created ${line}`);
  }
  if (!wroteRules) {
    logger.info('[acommit] No rules.yml (--skip-rules) — built-in defaults only.');
  }
}
