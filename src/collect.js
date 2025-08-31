// src/collect.js
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGit } from "./helper/git.js";
import { existsFile, isBinary } from "./utils/file.js";

const LABELS = {
  filename: "[FILENAME]: ",
  differences: "[DIFFERENCES]:",
  sep: "--------------------------------------------",
  blobUpdated: "(BLOB FILE UPDATED — CONTENT OMITTED)",
  blobNew: "(BLOB NEW FILE — CONTENT OMITTED)",
  blobDeleted: "(BLOB FILE DELETED — CONTENT OMITTED)",
  noDiff: "(NO DIFFERENCES)",
  newFileHeader: "(NEW FILE ENTIRE CONTENTS)",
  deleted: "(FILE DELETED)",
  truncated: (len, limit) => `/* truncated: ${len} bytes (limit ${limit}) */`,
};

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

  // "XY path" → { x, y, path }
  #parseLine(line) {
    const x = line[0], y = line[1];
    const pathPart = line.slice(3).trim();
    return { x, y, path: pathPart };
  }

  async #listDiffFiles() {
    const s = await this.git.statusPorcelain();
    if (!s) return [];
    const paths = s
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => this.#parseLine(l).path)
      .filter(p => !this.exclude.includes(p));
    return Array.from(new Set(paths));
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
    // 구분선 → 파일명 → 빈 줄 → [DIFFERENCES]:
    return [LABELS.sep, `${LABELS.filename}${filePath}`, "", LABELS.differences];
  }

  #close(lines) {
    // 엔트리 끝에 항상 개행 1줄 보장
    return [...lines, ""].join("\n");
  }

  #renderBinary({ tracked, deleted, filePath }) {
    const lines = this.#header(filePath);
    lines.push(
      deleted ? LABELS.blobDeleted : tracked ? LABELS.blobUpdated : LABELS.blobNew,
      ""
    );
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
    for (const filePath of files) out += await this.render(filePath);
    return out.trimEnd();
  }

  async forEachDiff(callback) {
    if (!(await this.#ensureRepo())) return;
    const files = await this.#listDiffFiles();
    for (const filePath of files) {
      const entry = await this.render(filePath);
      await callback(filePath, entry);
    }
  }
}