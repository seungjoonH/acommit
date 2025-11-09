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
    .action(async () => {
      const mod = await import('./commands/run.js');
      const fn = mod.run || mod.default;
      await fn('commit');
    });

  program
    .command("pr [number]")
    .description("Generate a PR description for the current diff or a specific GitHub PR.")
    .action(async (number) => {
      const mod = await import('./commands/run.js');
      const fn = mod.run || mod.default;
      await fn('pr', number);
    });

  program
    .command("issue <number>")
    .description("Draft an issue summary and linked PR description.")
    .action(async (number) => {
      const mod = await import('./commands/run.js');
      const fn = mod.run || mod.default;
      await fn('issue', number);
    });

  program
    .command('prompt')
    .description('Add a one-time or persistent helper prompt.')
    .option('-m, --message <msg>', 'Provide the prompt inline (skip editor).')
    .option('--save', 'Persist inside .acommit/rules.yml under prompts.')
    .action((opts) => promptCommand(opts));

  program
    .command('model')
    .description('Select which LLM provider (gemini|openai) to use.')
    .option('-p, --provider <name>', 'Set the provider without the picker.')
    .action(async (opts) => {
      const mod = await import('./commands/model.js');
      const fn = mod.modelCommand || mod.default;
      await fn(opts);
    });

  program
    .command("init")
    .description("Create .acommit/rules.yml from a template and update .gitignore.")
    .option("--lang <code>", "Template language (ko|en)", "ko")
    .action(async (opts) => {
      const mod = await import('./commands/init.js');
      const fn = mod.initConfig || mod.init || mod.default;
      await fn({ lang: opts.lang, cwd: process.cwd() });
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
