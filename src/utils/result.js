import fs from "node:fs/promises";
import path from "node:path";
import { nowStamp } from "./date.js";

export async function appendResult(cwd, content) {
  const dir = path.join(cwd, ".acommit", "results");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${nowStamp()}.md`);
  await fs.appendFile(file, `\n\n---\n\n${content.trim()}\n`, "utf8");
  return file;
}