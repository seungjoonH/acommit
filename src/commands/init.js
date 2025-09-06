// src/cmd/init.js
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATHS = {
  ko: path.resolve(__dirname, "../../templates/.acommit.ko.yml"),
  en: path.resolve(__dirname, "../../templates/.acommit.en.yml"),
};

export async function initConfig({ lang = "ko", cwd = process.cwd() } = {}) {
  const acomDir = path.join(cwd, ".acommit");
  const target = path.join(acomDir, "rules.yml");
  const templatePath = TEMPLATE_PATHS[lang] || TEMPLATE_PATHS.ko;

  // .acommit 디렉토리 없으면 생성
  await fs.mkdir(acomDir, { recursive: true });

  // rules.yml이 이미 존재하면 스킵
  try {
    await fs.access(target);
    console.log(`[acommit] .acommit/rules.yml already exists at ${target}`);
    return;
  } catch {}

  // 템플릿 복사
  const content = await fs.readFile(templatePath, "utf8");
  await fs.writeFile(target, content, "utf8");
  console.log(`[acommit] created .acommit/rules.yml (${lang}) at ${target}`);

  // .gitignore에 추가
  const gitignorePath = path.join(cwd, ".gitignore");
  try {
    let gitignore = "";
    
    try { gitignore = await fs.readFile(gitignorePath, "utf8"); } 
    catch {}

    if (!gitignore.includes(".acommit/")) {
      const updated = gitignore.trimEnd() + "\n.acommit/\n";
      await fs.writeFile(gitignorePath, updated, "utf8");
      console.log("[acommit] added '.acommit/' to .gitignore");
    }
  } catch (e) {
    console.warn("[acommit] warning: failed to update .gitignore", e.message);
  }
}