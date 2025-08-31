import { stat } from "node:fs/promises";
import path from "node:path";

const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg",
  ".mp4", ".mov", ".mkv", ".avi", ".webm",
  ".mp3", ".wav", ".flac", ".ogg", ".aac",
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar",
  ".woff", ".woff2", ".ttf", ".otf",
];

export function isBinary(filename) {
  const f = filename.toLowerCase();
  return BINARY_EXTENSIONS.some(ext => f.endsWith(ext));
}

export async function existsFile(cwd, filePath) {
  try { await stat(path.join(cwd, filePath)); return true; }
  catch { return false; }
}