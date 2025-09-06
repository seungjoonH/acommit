export const ENTRY_SEPARATOR = "--------------------------------------------";

export const LABELS = {
  filename: "[FILENAME]: ",
  differences: "[DIFFERENCES]:",
  sep: ENTRY_SEPARATOR,
  blobUpdated: "(BLOB FILE UPDATED — CONTENT OMITTED)",
  blobNew: "(BLOB NEW FILE — CONTENT OMITTED)",
  blobDeleted: "(BLOB FILE DELETED — CONTENT OMITTED)",
  noDiff: "(NO DIFFERENCES)",
  newFileHeader: "(NEW FILE ENTIRE CONTENTS)",
  deleted: "(FILE DELETED)",
  truncated: (len, limit) => `/* truncated: ${len} bytes (limit ${limit}) */`,
};

export const CHARS_PER_TOKEN = 3.6;