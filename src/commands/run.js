import chalk from "chalk";
import { DiffCollector } from "../core/diff/collector.js";
import { loadConfig } from "../core/config/load.js";
import { buildPromptFromDiff } from "../core/prompt/build.js";
import { gen } from "../core/llm/gemini.js";
import { ProgressUI } from "../ui/progress.js";
import { appendResult } from "../utils/result.js";

export async function run() {
  const cwd = process.cwd();
  const dc  = new DiffCollector({ cwd });
  const ui  = new ProgressUI();

  const files = await dc.listFiles();
  if (files.length === 0) return ui.note("[acommit] No changes detected");

  ui.info(`\n[acommit] Processing ${files.length} changed files...\n`);
  ui.startFiles(files.length);

  let diffText = "";
  for (const fp of files) {
    diffText += await dc.render(fp);
    ui.tickFile(fp);
  }
  ui.endFiles();

  // console.log(diffText);

  const cfg = await loadConfig(cwd);
  const { system, user, approxTokens } = buildPromptFromDiff(cfg, diffText);

  ui.startSpinner("Requesting LLM...");
  const out = await gen(`${system}\n\n${user}`);
  ui.stopSpinner("done.");

  const answer = out.trim();
  console.log(chalk.yellow("[acommit] Estimated prompt tokens:"), approxTokens);
  console.log("\n" + answer + "\n");

  const saved = await appendResult(cwd, answer);
  ui.note(`[acommit] Result saved at: ${saved}\n`);
}