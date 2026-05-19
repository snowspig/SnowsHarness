/**
 * Written File Tracker (PostToolUse)
 *
 * Tracks files written/edited during a session for batch-format.js
 * to process at Stop. Companion hook — do not use standalone.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const TRACKER_FILE = path.join(os.tmpdir(), "claude-written-files.json");

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  if (!filePath) return;

  let files = [];
  try {
    files = JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch { /* first write */ }

  if (!files.includes(filePath)) {
    files.push(filePath);
  }

  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(files));
  } catch { /* silently fail */ }
}

main();
