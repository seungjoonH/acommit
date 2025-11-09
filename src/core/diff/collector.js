import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGit } from "../../adapters/git.js";
import { existsFile, isBinary } from "../../utils/file.js";
import { LABELS } from "../constants.js";

export class DiffCollector {
  #repoChecked = false;
  #isRepo = false;

  constructor({ cwd = process.cwd(), exclude = [], untrackedSizeLimit = 512_000 } = {}) {
    this.cwd = cwd;
    this.exclude = exclude;
    this.untrackedSizeLimit = untrackedSizeLimit;
    this.git = createGit(cwd);
  }

  async #ensureRepo() {
    if (this.#repoChecked) return this.#isRepo;
    this.#isRepo = await this.git.isRepo();
    this.#repoChecked = true;
    return this.#isRepo;
  }

  #parseLine(line) {
    const x = line[0], y = line[1];
    let pathPart = line.slice(3);
    const arrow = " -> ";
    const idx = pathPart.indexOf(arrow);
    if (idx !== -1) pathPart = pathPart.slice(idx + arrow.length);
    return { x, y, path: pathPart.trim() };
  }

  async #listDiffFiles() {
    const porcelainRaw = await this.git.statusPorcelain();
    const porcelainPaths = (porcelainRaw || "")
      .split("\n")
      .map(l => l.trim()).filter(Boolean)
      .map(l => this.#parseLine(l).path);

    const [work, staged, untracked] = await Promise.all([
      this.git._run("diff", "--name-only").catch(() => ""),
      this.git._run("diff", "--cached", "--name-only").catch(() => ""),
      this.git._run("ls-files", "--others", "--exclude-standard").catch(() => ""),
    ]);
    const nameOnlyPaths = [work, staged, untracked]
      .join("\n")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const all = Array.from(new Set([...porcelainPaths, ...nameOnlyPaths]))
      .filter(p => !this.exclude.includes(p));

    if (process.env.ACOMMIT_DEBUG) {
      console.error("[acommit][debug] porcelain:", porcelainPaths);
      console.error("[acommit][debug] name-only:", nameOnlyPaths);
      console.error("[acommit][debug] union:", all);
    }
    return all;
  }

  async #getMeta(filePath) {
    const [exists, trackedGuess, dw, ds] = await Promise.all([
      existsFile(this.cwd, filePath),
      this.git.isTracked(filePath).catch(() => false),
      this.git.diff(filePath),
      this.git.diffCached(filePath),
    ]);
    const hasDiff = Boolean(dw || ds);
    const tracked = trackedGuess || hasDiff;
    const binary = isBinary(filePath);
    const deleted = !exists && hasDiff;
    return { exists, tracked, binary, deleted, dw, ds };
  }

  #header(filePath) {
    return [LABELS.sep, `${LABELS.filename}${filePath}`, "", LABELS.differences];
  }
  #close(lines) {
    return [...lines, ""].join("\n");
  }

  #renderBinary({ tracked, deleted, filePath }) {
    const lines = this.#header(filePath);
    lines.push(deleted ? LABELS.blobDeleted : (tracked ? LABELS.blobUpdated : LABELS.blobNew), "");
    return this.#close(lines);
  }

  #renderFromDiffs(filePath, { dw, ds, deleted }) {
    const lines = this.#header(filePath);
    if (deleted) lines.push(LABELS.deleted);
    if (!dw && !ds) lines.push(LABELS.noDiff, "");
    else {
      if (dw) lines.push(dw);
      if (ds) lines.push(ds);
    }
    return this.#close(lines);
  }

  async #renderUntracked(filePath) {
    const buf = await readFile(path.join(this.cwd, filePath));
    const lines = this.#header(filePath);
    lines.push(LABELS.newFileHeader);
    if (buf.length > this.untrackedSizeLimit) {
      lines.push(
        LABELS.truncated(buf.length, this.untrackedSizeLimit),
        buf.subarray(0, this.untrackedSizeLimit).toString("utf8"),
        ""
      );
    } else {
      lines.push(buf.toString("utf8"), "");
    }
    return this.#close(lines);
  }

  async render(filePath) {
    const meta = await this.#getMeta(filePath);
    if (!meta.exists && !meta.deleted) return "";
    if (meta.binary) return this.#renderBinary({ ...meta, filePath });
    if (meta.tracked || meta.deleted) return this.#renderFromDiffs(filePath, meta);
    return this.#renderUntracked(filePath);
  }

  async collectDiffText() {
    if (!(await this.#ensureRepo())) return "";
    const files = await this.#listDiffFiles();
    if (files.length === 0) return "";
    let out = "";
    for (const fp of files) out += await this.render(fp);
    return out.trimEnd();
  }

  async forEachDiff(callback) {
    if (!(await this.#ensureRepo())) return;
    const files = await this.#listDiffFiles();
    for (const fp of files) {
      const entry = await this.render(fp);
      await callback(fp, entry);
    }
  }

  // Progress helper method
  async listFiles() {
    if (!(await this.#ensureRepo())) return [];
    return this.#listDiffFiles();
  }
}
