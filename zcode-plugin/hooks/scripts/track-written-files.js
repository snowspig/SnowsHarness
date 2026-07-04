/**
 * Written File Tracker (PostToolUse, matcher: Write|Edit)
 *
 * Tracks files written/edited during a session for batch-format.js to process
 * at Stop. Companion hook — do not use standalone.
 *
 * ZCode: no output needed (silent tracker). Exit 0.
 */

const fs = require("fs");
const os = require("os");

// Per-session tracker file in the OS temp dir. Uses ZCODE_SESSION_ID when
// available so concurrent sessions don't clobber each other.
const sessionId =
  process.env.ZCODE_SESSION_ID ||
  process.env.CLAUDE_SESSION_ID ||
  "default";
const TRACKER_FILE =
  os.tmpdir() + "/zcode-written-files-" + sessionId + ".json";

function main() {
  let input = "";
  try {
    input = fs.readFileSync(0, "utf8");
  } catch {
    return;
  }
  let toolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    return;
  }

  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  if (!filePath) return;

  let files = [];
  try {
    files = JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch {
    /* first write */
  }

  if (!files.includes(filePath)) files.push(filePath);

  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(files));
  } catch {
    /* silently fail */
  }
}

main();
