import { SingleBar, Presets } from "cli-progress";
import pc from "picocolors";

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

export class ProgressUI {
  #bar = null;
  #spinTimer = null;
  #spinIndex = 0;
  #spinLabel = "";

  #withSpinnerPause(renderFn) {
    if (typeof renderFn !== 'function') return;
    if (this.#spinTimer && process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K');
    }
    renderFn();
  }

  startFiles(total) {
    if (this.#bar) this.endFiles();
    this.#bar = new SingleBar({
      format: `${pc.green("progress")} {bar} {percentage}% | {value}/{total} | {file}`,
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
    if (this.#bar) this.#bar.increment(1, { file: pc.dim(filePath) });
  }

  endFiles() {
    if (this.#bar) this.#bar.stop();
    this.#bar = null;
  }

  info(msg) { this.#withSpinnerPause(() => console.log(pc.cyan(msg))); }
  note(msg) { this.#withSpinnerPause(() => console.log(pc.dim(msg))); }
  warn(msg) { this.#withSpinnerPause(() => console.warn(pc.yellow(msg))); }

  startSpinner(label = "Working...") {
    if (this.#spinTimer) this.stopSpinner();
    this.#spinLabel = label;
    this.#spinIndex = 0;

    if (!process.stdout.isTTY) {
      process.stdout.write(`${pc.cyan(`[acommit] ${label}`)}\n`);
      return;
    }

    const renderFrame = () => {
      const frame = FRAMES[this.#spinIndex++ % FRAMES.length];
      process.stdout.write(`\r${pc.cyan(`[acommit] ${label}`)} ${frame} `);
    };

    renderFrame();
    this.#spinTimer = setInterval(renderFrame, 80);
  }

  stopSpinner(doneText = "done.") {
    if (this.#spinTimer) {
      clearInterval(this.#spinTimer);
      this.#spinTimer = null;
      this.#spinIndex = 0;
    }
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${pc.cyan(`[acommit] ${this.#spinLabel}`)} ${pc.green(doneText)}\n`);
    } else {
      process.stdout.write(`${pc.cyan(`[acommit] ${this.#spinLabel}`)} ${pc.green(doneText)}\n`);
    }
  }
}
