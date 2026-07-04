/**
 * Secret Detection Hook (PostToolUse, matcher: Write|Edit)
 *
 * After Write/Edit tool calls, scans the written content for API keys, tokens,
 * passwords, private keys, and credentials. Warns (does not block) so the
 * model can reconsider before the secret is committed.
 *
 * ZCode: warnings go to stdout JSON (additionalContext) so the model sees them.
 */

const fs = require("fs");
const path = require("path");
const { notify } = require("./_lib/zcode-output");

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: "API Key (sk-...)" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g, name: "Anthropic API Key" },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, name: "Google API Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub Personal Access Token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, name: "GitHub OAuth Token" },
  { pattern: /xox[bposa]-[a-zA-Z0-9-]{10,}/g, name: "Slack Token" },
  { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },
  {
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    name: "Private Key",
  },
  {
    pattern: /:\/\/[^:]+:([^@]{8,})@/g,
    name: "Password in connection string",
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/gi,
    name: "Hardcoded password",
  },
  {
    pattern: /(?:secret|token|api_key)\s*[=:]\s*["'][^"']{20,}["']/gi,
    name: "Hardcoded secret/token",
  },
];

const SAFE_PATHS = [
  ".env.example",
  ".env.template",
  ".env.sample",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "CHANGELOG.md",
];

function isSafeFile(filePath) {
  const basename = path.basename(filePath);
  return SAFE_PATHS.some((safe) => basename.includes(safe));
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
  const content =
    toolInput.tool_input?.content || toolInput.tool_input?.new_string || "";

  if (!content || !filePath) return;
  if (isSafeFile(filePath)) return;

  const findings = [];
  for (const { pattern, name } of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) findings.push({ type: name, count: matches.length });
  }

  if (findings.length === 0) return;

  const lines = [`=== 🔑 SECRET WARNING ${path.basename(filePath)} ===`];
  for (const { type, count } of findings) {
    lines.push(`  发现 ${count} 处疑似 ${type}`);
  }
  lines.push("  若非故意，请改用 .env 或配置文件存放，绝不要提交到版本控制。");

  notify(lines.join("\n"));
}

main();
