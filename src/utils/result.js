import fs from "node:fs/promises";
import path from "node:path";

async function migrateOldResults(cwd) {
  const base = path.join(cwd, ".acommit", "results");
  try {
    const entries = await fs.readdir(base, { withFileTypes: true });
    const commitsDir = path.join(base, "commits");
    await fs.mkdir(commitsDir, { recursive: true });
    for (const e of entries) {
      if (e.isFile()) {
        const from = path.join(base, e.name);
        const to = path.join(commitsDir, e.name);
        try { await fs.rename(from, to); } catch { /* collision */ }
      }
    }
  } catch { /* missing dir */ }
}

/**
 * Save a structured commit session as JSON.
 * @param {string} cwd  project root
 * @param {object} session  full session object
 * @returns {string}  path to the written file
 */
export async function saveSession(cwd, session) {
  const base = path.join(cwd, ".acommit", "results");
  await fs.mkdir(base, { recursive: true });
  await migrateOldResults(cwd);

  const dir = path.join(base, "commits");
  await fs.mkdir(dir, { recursive: true });

  const file = path.join(dir, `${session.id}.json`);
  await fs.writeFile(file, JSON.stringify(session, null, 2), "utf8");
  return file;
}
