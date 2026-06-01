/**
 * Config Protection Hook (PreToolUse)
 *
 * Blocks modifications to tool/linter config files.
 * Prevents the "fix the linter to satisfy the code" anti-pattern.
 *
 * Whitelist: CLAUDE.md, .claude/*, memory/* — Claude may modify these.
 *
 * Remove when: Claude reliably fixes code instead of weakening configs.
 */

const fs = require("fs");
const path = require("path");

const BLOCKED_PATTERNS = [
  /\.eslint(rc|\.config\.(js|ts|mjs|cjs|json))$/i,
  /eslint\.config\.(js|ts|mjs|cjs)$/i,
  /\.prettierrc(\.(js|ts|mjs|cjs|json|yaml|yml))?$/i,
  /prettier\.config\.(js|ts|mjs|cjs)$/i,
  /\.stylelintrc(\.(js|ts|mjs|cjs|json|yaml|yml))?$/i,
  /tsconfig\.?.*\.json$/i,
  /jsconfig\.json$/i,
  /ruff\.toml$/i,
  /pyproject\.toml$/i,
  /\.flake8$/i,
  /\.editorconfig$/i,
  /\.babelrc(\.json)?$/i,
  /babel\.config\.(js|ts|mjs|cjs|json)$/i,
  /vite\.config\.(js|ts|mjs|cjs)$/i,
  /next\.config\.(js|ts|mjs|cjs)/i,
  /tailwind\.config\.(js|ts|mjs|cjs)/i,
];

const ALLOWED_PATTERNS = [
  /CLAUDE\.md$/i,
  /[\\/]\.claude[\\/]/,
  /[\\/]memory[\\/]/,
  /\.claude\.md$/i,
];

function isBlocked(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const p of ALLOWED_PATTERNS) {
    if (p.test(normalized)) return false;
  }
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(normalized)) return true;
  }
  return false;
}

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  if (!filePath) return;

  if (isBlocked(filePath)) {
    const basename = path.basename(filePath);
    console.error(`[CONFIG PROTECTION] Blocked modification of ${basename}`);
    console.error("Fix the code to satisfy the linter, not the linter to accept the code.");
    console.error("If this change is intentional, run the command again with explicit approval.");
    process.exit(2);
  }
}

main();
