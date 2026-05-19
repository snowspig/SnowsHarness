/**
 * Batch Format Hook (Stop)
 *
 * Collects all files written/edited during the session (tracked via temp file)
 * and batch-runs prettier/ruff format once at session end.
 *
 * Does NOT run after every Edit — that's post-write-verify.js's job.
 *
 * Remove when: post-write-verify.js handles formatting adequately,
 * or formatting is fully automated by the editor.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const TRACKER_FILE = path.join(os.tmpdir(), "claude-written-files.json");

function getWrittenFiles() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch {
    return [];
  }
}

function clearTracker() {
  try { fs.unlinkSync(TRACKER_FILE); } catch { /* ignore */ }
}

function formatFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) return null;

  try {
    if ([".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".scss", ".html", ".md"].includes(ext)) {
      execSync(`npx prettier --write "${absPath}"`, { timeout: 10000, stdio: "pipe" });
      return "prettier";
    }
    if ([".py"].includes(ext)) {
      execSync(`ruff format "${absPath}"`, { timeout: 10000, stdio: "pipe" });
      return "ruff";
    }
  } catch {
    return "error";
  }
  return null;
}

function main() {
  const files = getWrittenFiles();
  if (files.length === 0) return;

  const results = { prettier: 0, ruff: 0, skipped: 0, errors: 0 };

  for (const filePath of files) {
    const result = formatFile(filePath);
    if (result === "prettier") results.prettier++;
    else if (result === "ruff") results.ruff++;
    else if (result === "error") results.errors++;
    else results.skipped++;
  }

  const total = results.prettier + results.ruff;
  if (total > 0) {
    console.error(`[BATCH FORMAT] Formatted ${total} files (prettier: ${results.prettier}, ruff: ${results.ruff})`);
  }
  if (results.errors > 0) {
    console.error(`[BATCH FORMAT] ${results.errors} files had formatting errors`);
  }

  clearTracker();
}

main();
