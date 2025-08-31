#!/usr/bin/env node
import { run } from "../src/index.js";
run().catch(e => { console.error("[acommit] fatal:", e?.stack || e); process.exit(1); });