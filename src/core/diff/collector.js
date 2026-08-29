import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGit } from "../../adapters/git.js";
import { existsFile, isBinary } from "../../utils/file.js";
import { matchesAnyGlob } from "../ignore/match.js";
import { LABELS } from "../constants.js";

const SAFETY_SKIP_DIRS = new Set([
  "node_modules",
  ".pnpm",
]);

function isSafetySkipped(filePath) {
  return String(filePath || "")
    .split("/")
    .some((part) => SAFETY_SKIP_DIRS.has(part));
}

export class DiffCollector {
  #repoChecked = false;
  #isRepo = false;

  constructor({
    cwd = process.cwd(),
    skip = [],
    omitContent = [],
    untrackedSizeLimit = 512_000,
  } = {}) {
    this.cwd = cwd;
    this.skip = skip;
    this.omitContent = omitContent;
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
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    let pathPart;
    if (line.length >= 3 && line[2] === " ") {
      pathPart = line.slice(3);
    } else if (line.length >= 2 && line[1] === " ") {
      pathPart = line.slice(2).trimStart();
    } else {
      pathPart = line.slice(3);
    }
    const arrow = " -> ";
    const idx = pathPart.indexOf(arrow);
    if (idx !== -1) pathPart = pathPart.slice(idx + arrow.length);
    return { x, y, path: pathPart.trim() };
  }

  #isSkipped(filePath) {
    return isSafetySkipped(filePath) || matchesAnyGlob(this.skip, filePath);
  }

  #omitContent(filePath) {
    return matchesAnyGlob(this.omitContent, filePath);
  }

  async #listDiffFiles() {
    const porcelainRaw = await this.git.statusPorcelain();
    const porcelainPaths = (porcelainRaw || "")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => this.#parseLine(l).path);

    const [work, staged, untracked] = await Promise.all([
      this.git._run("diff", "--name-only").catch(() => ""),
      this.git._run("diff", "--cached", "--name-only").catch(() => ""),
      this.git._run("ls-files", "--others", "--exclude-standard").catch(() => ""),
    ]);
    const nameOnlyPaths = [work, staged, untracked]
      .join("\n")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const all = Array.from(new Set([...porcelainPaths, ...nameOnlyPaths]))
      .filter((p) => !this.#isSkipped(p));

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

  #renderOmitted(filePath, meta) {
    const lines = this.#header(filePath);
    if (meta.deleted) {
      lines.push(LABELS.deleted);
    } else {
      const parts = [];
      if (!meta.tracked) parts.push("untracked");
      else parts.push("modified");
      if (meta.binary) parts.push("binary");
      const diffChars = (meta.dw?.length ?? 0) + (meta.ds?.length ?? 0);
      if (diffChars > 0) parts.push(`diff-size=${diffChars} chars`);
      lines.push(LABELS.contentOmitted);
      if (parts.length) lines.push(LABELS.metadataStatus(parts));
    }
    lines.push("");
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
    if (this.#omitContent(filePath)) return this.#renderOmitted(filePath, meta);
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

  async listFiles() {
    if (!(await this.#ensureRepo())) return [];
    return this.#listDiffFiles();
  }
}
