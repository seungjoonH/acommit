---
name: result
description: Read, explain, or open acommit commit-result sessions produced by either Agent or API backends. Use when the user asks for the latest commit result, generated messages, execution status, provenance, or the acommit result viewer.
---

# acommit result

Use `acommit result` when the user wants the browser viewer. For a textual answer, read the newest JSON file in `.acommit/results/commits/`, or the session the user identifies. Report backend provenance, provider/model or agent host, groups and files, validation, and actual commit/push status. Clearly distinguish generated drafts from executed Git commits. Never claim execution from a missing or false execution field.
