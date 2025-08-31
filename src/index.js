import { DiffCollector } from "./collect.js";

export async function run() {
  const cwd = process.cwd();
  const dc = new DiffCollector({ cwd });
  const text = await dc.collectDiffText();
  if (!text) { console.log("[acommit] 변경 없음"); return; }
  console.log(text);
}