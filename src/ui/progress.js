import { SingleBar, Presets } from "cli-progress";
import chalk from "chalk";

export class ProgressUI {
  #bar = null;
  #spinTimer = null;
  #spinIndex = 0;
  #spinLabel = "";

  startFiles(total) {
    if (this.#bar) this.endFiles();
    this.#bar = new SingleBar({
      format: `${chalk.green("progress")} {bar} {percentage}% | {value}/{total} | {file}`,
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
      autopadding: true,
      stopOnComplete: true,
      clearOnComplete: true,
    }, Presets.shades_classic);
    this.#bar.start(total, 0, { file: "" });
  }

  tickFile(filePath = "") {
    if (this.#bar) this.#bar.increment(1, { file: chalk.dim(filePath) });
  }

  endFiles() {
    if (this.#bar) this.#bar.stop();
    this.#bar = null;
  }

  info(msg) { console.log(chalk.cyan(msg)); }
  note(msg) { console.log(chalk.gray(msg)); }
  warn(msg) { console.warn(chalk.yellow(msg)); }

  startSpinner(label = "Working...") {
    if (this.#spinTimer) this.stopSpinner();
    this.#spinLabel = label;

    const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    const write = (text) => process.stdout.write(text);

    if (!process.stdout.isTTY) {
      console.log(chalk.cyan(`[acommit] ${label} ...`));
      return;
    }

    this.#spinTimer = setInterval(() => {
      const frame = frames[this.#spinIndex++ % frames.length];
      write(`\r${chalk.cyan(`[acommit] ${label} `)}${frame}  `);
    }, 80);
  }

  stopSpinner(doneText = "done.") {
    if (!this.#spinTimer) {
      console.log(chalk.cyan(`[acommit] ${this.#spinLabel} `) + chalk.green(doneText));
      return;
    }
    clearInterval(this.#spinTimer);
    this.#spinTimer = null;
    this.#spinIndex = 0;

    process.stdout.write(
      `\r${chalk.cyan(`[acommit] ${this.#spinLabel} `)}${chalk.green(doneText)}\n`
    );
  }
}