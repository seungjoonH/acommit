#!/usr/bin/env node
import { Command } from "commander";
import { run } from "../src/index.js";
import { initConfig } from "../src/cmd/init.js";

const program = new Command();

program
  .command("init")
  .description("Create default .acommit.yml config")
  .option("--lang <lang>", "template language (ko|en)", "ko")
  .action(opts => initConfig({ lang: opts.lang }));

program
  .command("run")
  .description("Generate commit messages")
  .action(() => run());

program.parse(process.argv);