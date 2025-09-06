import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { normalize } from "./schema.js";

export async function loadConfig(cwd = process.cwd()) {
  const file = path.join(cwd, ".acommit", "rules.yml");
  try {
    const raw = await fs.readFile(file, "utf8");
    const user = YAML.parse(raw) || {};
    return normalize(user);
  } 
  catch { return normalize({}); }
}