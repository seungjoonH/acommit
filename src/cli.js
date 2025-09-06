import { Command } from "commander";
import { run as cmdRun } from "./commands/run.js";
import { initConfig as cmdInit } from "./commands/init.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

export async function main(argv = process.argv) {
  const program = new Command();

  program
    .name("acommit")
    .description("AI-assisted, configurable commit message generator")
    .version(pkg.version);

  program
    .command("run")
    .description("collect diffs and generate commit messages")
    .option("-C, --cwd <path>", "working directory", process.cwd())
    .action(async (opts) => {
      if (opts.cwd && opts.cwd !== process.cwd()) process.chdir(opts.cwd);
      await cmdRun();
    });

  program
    .command("init")
    .description("create .acommit/rules.yml from template and update .gitignore")
    .option("--lang <code>", "template language (ko|en)", "ko")
    .option("-C, --cwd <path>", "working directory", process.cwd())
    .action(async (opts) => {
      if (opts.cwd && opts.cwd !== process.cwd()) process.chdir(opts.cwd);
      await cmdInit({ lang: opts.lang, cwd: process.cwd() });
    });

  program
    .hook("postAction", () => {}) 
    .showHelpAfterError();

  if (argv.length <= 2) {
    await cmdRun();
    return;
  }
  await program.parseAsync(argv);
}