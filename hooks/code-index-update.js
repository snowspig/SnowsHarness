/**
 * Code Index Dirty-File Tracker (PostToolUse, matcher Write|Edit)
 *
 * Appends paths of recently written/edited source files to
 * `<projectDir>/.snows-index/dirty-files.json` so the next
 * session-start can re-index only what changed.
 *
 * Why: Avoids walking the whole tree when only a handful of files
 *   have been touched since the last index build.
 * Remove when: the session-start hook does incremental diffing
 *   directly from filesystem mtimes (Database.getChangedFiles
 *   already supports this — call site TBD).
 */

const fs = require("fs");
const path = require("path");
const { isSourceFile } = require("./code-index/utils");

const INDEX_DIR = ".snows-index";
const DIRTY_FILE = "dirty-files.json";

const resolveProjectDir = () => {
  return (
    process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_DIR || process.cwd()
  );
};

const loadDirtySet = (dirtyPath) => {
  try {
    const raw = fs.readFileSync(dirtyPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
};

const saveDirtySet = (dirtyPath, set) => {
  try {
    fs.mkdirSync(path.dirname(dirtyPath), { recursive: true });
    fs.writeFileSync(dirtyPath, JSON.stringify([...set], null, 2), "utf8");
  } catch {
    /* never block the workflow */
  }
};

function main() {
  let input = "";
  try {
    input = fs.readFileSync(0, "utf8");
  } catch {
    return;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    return;
  }

  const filePath = data && data.tool_input && data.tool_input.file_path;
  if (!filePath || !isSourceFile(filePath)) return;

  const projectDir = resolveProjectDir();
  const dirtyPath = path.join(projectDir, INDEX_DIR, DIRTY_FILE);
  const dirty = loadDirtySet(dirtyPath);
  dirty.add(filePath);
  saveDirtySet(dirtyPath, dirty);
}

main();
