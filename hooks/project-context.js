/**
 * Project Context Injector (SessionStart)
 *
 * Detects project type from directory path and CLAUDE.md content,
 * then outputs project-specific context hints for the session.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const HOME = os.homedir();

const PROJECT_RULES = [
  {
    match: /quant|qlib|trading|strategy|xtquant/i,
    context: [
      "Conda env: qlib_env (activate: conda activate qlib_env)",
      "Data: MongoDB 192.168.8.234:27017",
      "Python 3.10+ required",
    ],
  },
  {
    match: /snowsrouter|ppchat/i,
    context: [
      "SnowsRouter (deployed on OpenWrt at 192.168.8.1:8856)",
      "No local config — Claude Code points to router via ANTHROPIC_BASE_URL",
      "Test: curl -s -o /dev/null -w '%{http_code}' http://192.168.8.1:8856/",
    ],
  },
  {
    match: /frontend|react|next|vue/i,
    context: [
      "Node 20+ / pnpm preferred",
      "Dev: npm run dev",
    ],
  },
];

function detectProjectContext(cwd) {
  const lines = [];

  // Check directory name
  for (const rule of PROJECT_RULES) {
    if (rule.match.test(cwd)) {
      lines.push(...rule.context);
      break;
    }
  }

  // Check CLAUDE.md for extra hints
  const claudeMdPaths = [
    path.join(cwd, "CLAUDE.md"),
    path.join(cwd, ".claude", "CLAUDE.md"),
  ];

  for (const p of claudeMdPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, "utf8");
        // Extract Python version requirements
        const pyMatch = content.match(/Python\s+(\d+\.\d+)/i);
        if (pyMatch && !lines.some((l) => l.includes("Python"))) {
          lines.push(`Python ${pyMatch[1]}+ required`);
        }
        // Extract conda env references
        const condaMatch = content.match(/conda[_ ]env[.:]\s*(\S+)/i);
        if (condaMatch && !lines.some((l) => l.includes("conda"))) {
          lines.push(`Conda env: ${condaMatch[1]}`);
        }
      } catch {
        // silent
      }
      break;
    }
  }

  return lines;
}

function main() {
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const context = detectProjectContext(cwd);
  if (context.length === 0) return;

  const lines = ["[Project Context]"];
  for (const hint of context) {
    lines.push(`  ${hint}`);
  }
  console.error(lines.join("\n"));
}

main();
