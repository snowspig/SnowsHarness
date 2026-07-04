/**
 * Batch Format Hook (Stop)
 *
 * Collects all files written/edited during the session (tracked via temp file
 * by track-written-files.js) and batch-runs prettier/ruff once at session end.
 *
 * ZCode: status is reported via stdout JSON (additionalContext) so the model
 * knows formatting ran. Logs also go to stderr for diagnostics.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { notify } = require("./_lib/zcode-output");

const sessionId =
  process.env.ZCODE_SESSION_ID ||
  process.env.CLAUDE_SESSION_ID ||
  "default";
const TRACKER_FILE =
  os.tmpdir() + "/zcode-written-files-" + sessionId + ".json";

function getWrittenFiles() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch {
    return [];
  }
}

function clearTracker() {
  try {
    fs.unlinkSync(TRACKER_FILE);
  } catch {
    /* ignore */
  }
}

function formatFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) return null;

  try {
    if (
      [".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".scss", ".html", ".md"].includes(
        ext,
      )
    ) {
      execSync(`npx prettier --write "${absPath}"`, {
        timeout: 10000,
        stdio: "pipe",
      });
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
    notify(
      `[BATCH FORMAT] 已格式化 ${total} 个文件 ` +
        `(prettier: ${results.prettier}, ruff: ${results.ruff})。` +
        (results.errors > 0
          ? `${results.errors} 个文件格式化失败。`
          : ""),
    );
  }

  clearTracker();
}

main();
