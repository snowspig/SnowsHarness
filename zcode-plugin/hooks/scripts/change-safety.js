/**
 * Change Safety Hook (PreToolUse, matcher: Edit)
 *
 * Prevents Edit operations based on stale context by verifying that
 * old_string still matches the current file content.
 *
 * ZCode: blocking is done via stdout JSON permissionDecision:"deny" with a
 * model-visible reason, instead of exit code 2.
 */

const fs = require("fs");
const { deny } = require("./_lib/zcode-output");

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

  if (toolInput.tool_name !== "Edit") return;

  const filePath = toolInput.tool_input?.file_path || "";
  const oldString = toolInput.tool_input?.old_string || "";

  if (!filePath || !oldString) return;

  let currentContent;
  try {
    currentContent = fs.readFileSync(filePath, "utf8");
  } catch {
    return; // File doesn't exist yet — fine for new files
  }

  // Normalize line endings to LF on both sides.
  const normalizedContent = currentContent.replace(/\r\n/g, "\n");
  const normalizedOld = oldString.replace(/\r\n/g, "\n");

  if (!normalizedContent.includes(normalizedOld)) {
    deny(
      `[CHANGE SAFETY] Edit 的 old_string 与文件当前内容不符。\n` +
        `文件: ${filePath}\n` +
        "该文件可能自上次读取后已被修改。\n" +
        "请先 Read 该文件，再用当前内容重新发起 Edit。",
    );
    return;
  }
}

main();
