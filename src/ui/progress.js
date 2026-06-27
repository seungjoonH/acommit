import { SingleBar, Presets } from "cli-progress";
import chalk from "chalk";
import readline from "node:readline";

export class ProgressUI {
  #bar = null;
  #spinTimer = null;
  #spinIndex = 0;
  #spinLabel = "";

  #clearSpinnerLine({ force = false } = {}) {
    if (!process.stdout.isTTY) return;
    if (!this.#spinTimer && !force) return;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  }

  #withSpinnerPause(renderFn) {
    if (typeof renderFn !== 'function') return;
    if (!this.#spinTimer || !process.stdout.isTTY) {
      renderFn();
      return;
    }
    this.#clearSpinnerLine();
    renderFn();
  }

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

  info(msg) { this.#withSpinnerPause(() => console.log(chalk.cyan(msg))); }
  note(msg) { this.#withSpinnerPause(() => console.log(chalk.gray(msg))); }
  warn(msg) { this.#withSpinnerPause(() => console.warn(chalk.yellow(msg))); }

  startSpinner(label = "Working...") {
    if (this.#spinTimer) this.stopSpinner();
    this.#spinLabel = label;
    this.#spinIndex = 0;

    const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

    if (!process.stdout.isTTY) {
      console.log(chalk.cyan(`[acommit] ${label} ...`));
      return;
    }

    const renderFrame = () => {
      const frame = frames[this.#spinIndex++ % frames.length];
      this.#clearSpinnerLine();
      process.stdout.write(`${chalk.cyan(`[acommit] ${label} `)}${frame}  `);
    };

    renderFrame();
    this.#spinTimer = setInterval(renderFrame, 80);
  }

  stopSpinner(doneText = "done.") {
    if (!this.#spinTimer || !process.stdout.isTTY) {
      console.log(chalk.cyan(`[acommit] ${this.#spinLabel} `) + chalk.green(doneText));
      return;
    }
    clearInterval(this.#spinTimer);
    this.#spinTimer = null;
    this.#spinIndex = 0;

    this.#clearSpinnerLine({ force: true });
    process.stdout.write(
      `${chalk.cyan(`[acommit] ${this.#spinLabel} `)}${chalk.green(doneText)}\n`
    );
  }
}
