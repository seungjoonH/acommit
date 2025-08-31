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
    // 초기커밋/미추적/스테이징/삭제 모두 포함
    return this._run("status", "--porcelain=1", "-uall");
  }

  async diff(file)       { return this._run("diff", "--", file); }
  async diffCached(file) { return this._run("diff", "--cached", "--", file); }
}

export const createGit = (cwd = process.cwd()) => new Git(cwd);