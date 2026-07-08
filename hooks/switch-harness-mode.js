#!/usr/bin/env node

/**
 * Switch the active rule set between "full" and "mini" after deploy.
 *
 * Design: deploy stages both reference trees at ~/.claude/rules-full and
 * ~/.claude/rules-mini, plus a ~/.claude/harness-mode.json recording the active
 * mode. This script copies the chosen reference tree into ~/.claude/rules (the
 * directory Claude Code actually reads) and updates harness-mode.json.
 *
 * Usage:
 *   node switch-harness-mode.js             # print current mode (read-only)
 *   node switch-harness-mode.js mini        # switch to compressed rules
 *   node switch-harness-mode.js full        # switch to complete rules
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const RULES_DIR = path.join(CLAUDE_DIR, "rules"); // active — what Claude reads
const RULES_FULL_DIR = path.join(CLAUDE_DIR, "rules-full"); // reference
const RULES_MINI_DIR = path.join(CLAUDE_DIR, "rules-mini"); // reference
const CONFIG_FILE = path.join(CLAUDE_DIR, "harness-mode.json");

const REFERENCE_DIRS = {
  full: RULES_FULL_DIR,
  mini: RULES_MINI_DIR,
};

// --- helpers ---
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch (err) {
    // Missing or unreadable → bootstrap a fresh config rather than crashing.
    // (Older deploys never wrote this file; we recover instead of erroring out.)
    return { mode: null, note: "Managed by switch-harness-mode.js" };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function replaceRulesFrom(srcDir) {
  // Wipe the active rules dir and copy the chosen reference tree into it.
  fs.rmSync(RULES_DIR, { recursive: true, force: true });
  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.cpSync(srcDir, RULES_DIR, { recursive: true });
}

// --- no-arg path: print current mode and exit without mutating anything ---
const requested = process.argv[2];
if (!requested) {
  const cfg = readConfig();
  const mode = cfg.mode || "(unknown)";
  const hasFull = fs.existsSync(RULES_FULL_DIR);
  const hasMini = fs.existsSync(RULES_MINI_DIR);
  console.log(`Current mode: ${mode}`);
  console.log(
    `Reference dirs: rules-full=${hasFull ? "present" : "MISSING"}, rules-mini=${hasMini ? "present" : "MISSING"}`,
  );
  if (!hasFull || !hasMini) {
    console.log(
      "\nOne or both reference trees are missing — re-run deploy to stage them:",
    );
    console.log("  ./deploy.sh --force   # or .\\deploy.ps1 -Force");
  } else {
    console.log("\nSwitch with: node switch-harness-mode.js [mini|full]");
  }
  process.exit(0);
}

// --- validate argument ---
if (!["mini", "full"].includes(requested)) {
  console.error("Usage: node switch-harness-mode.js [mini|full]");
  console.error("  (no argument prints the current mode)");
  process.exit(1);
}

// --- ensure the target reference tree exists ---
const srcDir = REFERENCE_DIRS[requested];
if (!fs.existsSync(srcDir)) {
  console.error(`Error: reference directory not found: ${srcDir}`);
  console.error("Run deploy first to stage both rule sets:");
  console.error("  ./deploy.sh --force   # or .\\deploy.ps1 -Force");
  process.exit(1);
}

// --- switch ---
replaceRulesFrom(srcDir);

const cfg = readConfig();
cfg.mode = requested;
writeConfig(cfg);

const savingsNote =
  requested === "mini"
    ? "compressed rules (~17% token savings vs full)"
    : "complete rules with detailed examples";
console.log(`✓ Switched to ${requested.toUpperCase()} mode — ${savingsNote}`);
console.log("\n⚠️  Restart Claude Code for the new rules to take effect.");
