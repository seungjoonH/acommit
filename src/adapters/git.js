import { execFile } from "node:child_process";
import { promisify } from "node:util";

const sh = promisify(execFile);
const DBG = process.env.ACOMMIT_DEBUG;

export class Git {
  constructor(cwd = process.cwd()) { this.cwd = cwd; }

  async _run(...args) {
    const { stdout } = await sh("git", args, { cwd: this.cwd });
    if (DBG) console.error("[acommit][git]", this.cwd, "$ git", args.join(" "), "\n", stdout);
    return stdout.trim();
  }

  async isRepo() {
    const out = await this._run("rev-parse", "--is-inside-work-tree").catch(() => "");
    return out.toLowerCase() === "true";
  }

  async isTracked(file) {
    return this._run("ls-files", "--error-unmatch", file).then(() => true).catch(() => false);
  }

  async statusPorcelain() {
    return this._run("status", "--porcelain=1", "-uall");
  }

  async diff(file)       { return this._run("diff", "--", file); }
  async diffCached(file) { return this._run("diff", "--cached", "--", file); }
  async history({ maxCount = 200, since } = {}) {
    const args = [
      "log",
      "--no-merges",
      `--max-count=${maxCount}`,
      "--format=__ACOMMIT_RECORD__%n%H%n%an%n%ae%n%s%n%b%n__ACOMMIT_FILES__",
      "--name-only",
    ];
    if (since) args.splice(3, 0, `--since=${since}`);
    return this._run(...args);
  }

  async add(files)     { return this._run("add", "--", ...files); }
  async commit(message) { return this._run("commit", "-m", message); }
  async commitOnly(message, files) {
    return this._run("commit", "--only", "-m", message, "--", ...files);
  }
  async push()          { return this._run("push"); }
}

export const createGit = (cwd = process.cwd()) => new Git(cwd);
