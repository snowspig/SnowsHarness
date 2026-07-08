#!/usr/bin/env node

/**
 * Switch between full and mini harness modes
 * Usage: node ~/.claude/hooks/switch-harness-mode.js [mini|full]
 */

const fs = require("fs");
const path = require("path");

const CLAUDE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude",
);
const CONFIG_FILE = path.join(CLAUDE_DIR, "harness-mode.json");
const RULES_DIR = path.join(CLAUDE_DIR, "rules");
const RULES_MINI_DIR = path.join(CLAUDE_DIR, "rules-mini");

const mode = process.argv[2] || "mini";

if (!["full", "mini"].includes(mode)) {
  console.error("Usage: node switch-harness-mode.js [mini|full]");
  process.exit(1);
}

// Read current config
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
} catch (err) {
  console.error(`Error reading ${CONFIG_FILE}:`, err.message);
  process.exit(1);
}

// Backup current rules
const backupDir = path.join(CLAUDE_DIR, `rules-backup-${Date.now()}`);
if (mode === "mini" && fs.existsSync(RULES_DIR)) {
  console.log(`Backing up current rules to ${backupDir}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.cpSync(RULES_DIR, backupDir, { recursive: true });
}

// Switch modes
if (mode === "mini") {
  // Check if rules-mini exists
  if (!fs.existsSync(RULES_MINI_DIR)) {
    console.error("Error: rules-mini directory not found. Run setup first.");
    process.exit(1);
  }
  // Rename rules to rules-full
  if (
    fs.existsSync(RULES_DIR) &&
    !fs.existsSync(path.join(CLAUDE_DIR, "rules-full"))
  ) {
    fs.renameSync(RULES_DIR, path.join(CLAUDE_DIR, "rules-full"));
  }
  // Copy rules-mini to rules
  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.cpSync(RULES_MINI_DIR, RULES_DIR, { recursive: true });
  console.log(
    "✓ Switched to MINI mode (compressed rules, ~54% token reduction)",
  );
} else {
  // Restore full version
  const rulesFullDir = path.join(CLAUDE_DIR, "rules-full");
  if (fs.existsSync(rulesFullDir)) {
    fs.rmSync(RULES_DIR, { recursive: true, force: true });
    fs.renameSync(rulesFullDir, RULES_DIR);
    console.log("✓ Switched to FULL mode (complete detailed rules)");
  } else {
    console.log("Already in full mode or backup not found.");
  }
}

// Update config
config.mode = mode;
fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

console.log("\n⚠️  Restart Claude Code for changes to take effect.");
