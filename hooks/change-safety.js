/**
 * Change Safety Hook (PreToolUse)
 *
 * Prevents Edit operations based on stale context by verifying
 * that old_string still matches the current file content.
 *
 * Remove when: Claude always reads files before editing, or context
 * windows grow large enough that stale context is rare.
 */

const fs = require("fs");

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
    return; // File doesn't exist yet — that's fine for new files
  }

  // Normalize line endings: both file content and old_string to LF
  const normalizedContent = currentContent.replace(/\r\n/g, "\n");
  const normalizedOld = oldString.replace(/\r\n/g, "\n");

  if (!normalizedContent.includes(normalizedOld)) {
    console.error(
      `[CHANGE SAFETY] Edit old_string does not match current file content.`,
    );
    console.error(`File: ${filePath}`);
    console.error(`The file may have changed since it was last read.`);
    console.error(
      `Action: Read the file first, then retry the edit with the current content.`,
    );
    process.exit(2);
  }
}

main();
