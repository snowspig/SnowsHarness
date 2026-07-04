/**
 * Config Protection Hook (PreToolUse)
 *
 * Blocks modifications to tool/linter config files. Prevents the "fix the
 * linter to satisfy the code" anti-pattern.
 *
 * Whitelist: AGENTS.md, CLAUDE.md, .zcode/*, .claude/*, memory/* — these may
 * be modified freely.
 *
 * ZCode: blocking is done via stdout JSON permissionDecision:"deny" (with a
 * reason the model sees), instead of exit code 2.
 */

const fs = require("fs");
const path = require("path");
const { deny } = require("./_lib/zcode-output");

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
  /AGENTS\.md$/i,
  /CLAUDE\.md$/i,
  /[\\/]\.zcode[\\/]/,
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

  if (isBlocked(filePath)) {
    const basename = path.basename(filePath);
    deny(
      `[CONFIG PROTECTION] 已阻止修改 ${basename}。\n` +
        "应修改代码来满足 linter，而不是放宽 linter 来迁就代码。\n" +
        "若确需修改该配置，请向用户说明原因并获得明确确认。",
    );
    return;
  }
}

main();
