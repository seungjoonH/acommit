#!/usr/bin/env node
import { main } from "../src/cli.js";

main().catch(e => {
  console.error("[acommit] fatal:", e?.stack || e);
  process.exit(1);
});