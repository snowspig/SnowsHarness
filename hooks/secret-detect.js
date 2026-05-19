/**
 * Secret Detection Hook
 *
 * After Write/Edit tool calls, scan the written content for:
 * - API keys, tokens, passwords
 * - Private keys, certificates
 * - Database connection strings with credentials
 *
 * Inspired by DeerFlow's GuardrailMiddleware concept.
 */

const fs = require("fs");
const path = require("path");

// Patterns that indicate secrets - should NEVER be in source code
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: "API Key (sk-...)" },
  { pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g, name: "Anthropic API Key" },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g, name: "Google API Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub Personal Access Token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, name: "GitHub OAuth Token" },
  { pattern: /xox[bposa]-[a-zA-Z0-9-]{10,}/g, name: "Slack Token" },

  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },

  // Private Keys
  { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g, name: "Private Key" },

  // Passwords in connection strings
  { pattern: /:\/\/[^:]+:([^@]{8,})@/g, name: "Password in connection string" },

  // Generic high-entropy tokens
  { pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{8,}["']/gi, name: "Hardcoded password" },
  { pattern: /(?:secret|token|api_key)\s*[=:]\s*["'][^"']{20,}["']/gi, name: "Hardcoded secret/token" },
];

// Files that are safe to contain secrets
const SAFE_PATHS = [
  ".env.example",
  ".env.template",
  ".env.sample",
  "CLAUDE.md",
  "README.md",
  "CHANGELOG.md",
];

function isSafeFile(filePath) {
  const basename = path.basename(filePath);
  return SAFE_PATHS.some((safe) => basename.includes(safe));
}

function main() {
  // Read input from stdin (Claude Code passes tool call info)
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

  // Only check Write and Edit tools
  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  const content = toolInput.tool_input?.content || toolInput.tool_input?.new_string || "";

  if (!content || !filePath) return;
  if (isSafeFile(filePath)) return;

  // Scan for secrets
  const findings = [];
  for (const { pattern, name } of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push({ type: name, count: matches.length });
    }
  }

  if (findings.length > 0) {
    console.error(`[SECRET WARNING] ${path.basename(filePath)}:`);
    for (const { type, count } of findings) {
      console.error(`  Found ${count} potential ${type}`);
    }
    console.error("  If these are intentional, add to .env or config files.");
    console.error("  NEVER commit secrets to version control.");
  }
}

main();
