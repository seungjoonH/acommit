import { Command } from "commander";
import promptCommand from './commands/prompt.js';
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

export async function main(argv = process.argv) {
  const program = new Command();

  program.option('-V, --verbose', 'Enable verbose logging.');

  program
    .name("acommit")
    .description("AI-assisted commit workflow automation CLI")
    .version(pkg.version, '-v, --version', 'Print the current version.');

  program
    .command("commit")
    .description("Analyze local diffs and draft commit messages.")
    .option('--headless', 'Run without browser or interactive UI.')
    .option('--json', 'Write one JSON result to stdout (requires --headless).')
    .action(async (opts) => {
      if (opts.json && !opts.headless) throw new Error('--json requires --headless');
      if (opts.headless) {
        const { runHeadlessCommit } = await import('./core/commit/headless.js');
        try {
          const result = await runHeadlessCommit({ cwd: process.cwd() });
          if (opts.json) process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
          else logger.info(`[acommit] saved ${result.saved || 'no changes'}`);
        } catch (err) {
          if (opts.json) process.stdout.write(`${JSON.stringify({ ok: false, error: err?.message || String(err), code: err?.code || null })}\n`);
          else logger.error(err?.message || String(err), { exit: false });
          process.exitCode = 1;
        }
        return;
      }
      const mod = await import('./commands/run.js');
      const fn = mod.run || mod.default;
      await fn();
    });

  program
    .command('prompt')
    .description('Add a one-time or persistent helper prompt.')
    .option('-m, --message <msg>', 'Provide the prompt inline (skip editor).')
    .option('--save', 'Persist inside .acommit/rules.yml under prompts.')
    .action((opts) => promptCommand(opts));

  program
    .command('model')
    .description('Select LLM route, vendor, and model (direct API or OpenRouter).')
    .option('-p, --provider <name>', 'Runtime provider: gemini | openai | openrouter')
    .option('-m, --model <id>', 'Provider model id (discover interactively or enter explicitly)')
    .action(async (opts) => {
      const mod = await import('./commands/model.js');
      const fn = mod.modelCommand || mod.default;
      await fn(opts);
    });

  program
    .command("init")
    .description("Interactive setup: rules.yml options and .gitignore.")
    .option("--lang <code>", "UI + rules.yml comment locale for non-interactive init (ko|en)", "ko")
    .option("--configure", "Non-interactive: create rules.yml with defaults")
    .option("--skip-rules", "Non-interactive: skip rules.yml (use built-in defaults)")
    .option("--gitignore <mode>", "Non-interactive: none | results | all")
    .action(async (opts) => {
      const mod = await import('./commands/init.js');
      const fn = mod.initConfig || mod.init || mod.default;
      await fn({
        lang: opts.lang,
        cwd: process.cwd(),
        configure: opts.configure || undefined,
        skipRules: opts.skipRules || undefined,
        gitignore: opts.gitignore,
        nonInteractive: Boolean(opts.configure || opts.skipRules || opts.gitignore),
      });
    });

  program
    .command('rules')
    .description('Open the rules editor UI in your browser.')
    .option('-p, --port <number>', 'Local server port', '3000')
    .option('--no-open', 'Do not open a browser tab automatically.')
    .action(async (opts) => {
      const mod = await import('./commands/rules.js');
      const fn = mod.rulesCommand || mod.default;
      await fn({ port: Number(opts.port), open: opts.open });
    });

  program
    .command('locale')
    .description('View or change the UI language (ko | en).')
    .argument('[lang]', 'Set locale directly without interactive picker (ko | en)')
    .action(async (lang) => {
      const mod = await import('./commands/locale.js');
      const fn = mod.localeCommand || mod.default;
      await fn({ set: lang });
    });

  program
    .command('result')
    .description('Open the commit result viewer in your browser.')
    .option('-p, --port <number>', 'Local server port', '3000')
    .option('--no-open', 'Do not open a browser tab automatically.')
    .action(async (opts) => {
      const mod = await import('./commands/result.js');
      const fn = mod.resultCommand || mod.default;
      await fn({ port: Number(opts.port), open: opts.open });
    });

  program
    .hook('preAction', (thisCommand) => {
      const globalOpts = (thisCommand.parent && typeof thisCommand.parent.opts === 'function')
        ? thisCommand.parent.opts()
        : program.opts();
      if (globalOpts && globalOpts.verbose) {
        logger.setLevel('VERBOSE');
        logger.info('Verbose logging enabled.');
      }
    })
    .hook("postAction", () => {}) 
    .showHelpAfterError();

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}
