import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATHS = {
  ko: path.resolve(__dirname, "../../templates/.acommit.ko.yml"),
  en: path.resolve(__dirname, "../../templates/.acommit.en.yml"),
};

export async function initConfig({ lang = "ko", cwd = process.cwd() } = {}) {
  const target = path.join(cwd, ".acommit.yml");
  const templatePath = TEMPLATE_PATHS[lang] || TEMPLATE_PATHS.ko;

  try {
    await fs.access(target);
    console.log(`[acommit] .acommit.yml already exists at ${target}`);
    return;
  } catch {}

  const content = await fs.readFile(templatePath, "utf8");
  await fs.writeFile(target, content, "utf8");
  console.log(`[acommit] created .acommit.yml (${lang}) at ${target}`);
}