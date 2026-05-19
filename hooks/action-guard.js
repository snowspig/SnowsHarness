/**
 * Action Guard Hook
 *
 * PreToolUse hook that warns on risky operations before execution.
 * Inspired by OpenHands-style safety guardrails.
 *
 * Checks:
 * - Destructive shell commands (rm -rf, taskkill /F, docker rm, etc.)
 * - Sensitive file operations (.env, credentials, keys)
 * - Risky git operations (push --force, reset --hard)
 * - External network requests to unknown hosts
 *
 * This hook does NOT block operations — it only warns.
 */

const fs = require("fs");
const path = require("path");

// Policy configuration — could be moved to a separate policies.json file
const POLICY = {
  dangerous_commands: [
    "rm -rf",
    "rm -r",
    "del /q",
    "taskkill /f",
    "taskkill /f /im",
    "docker rm",
    "docker rmi",
    "docker-compose down -v",
    "docker compose down -v",
    "git clean -fd",
    "git reset --hard",
  ],
  sensitive_patterns: [
    /\.env$/i,
    /credentials/i,
    /private.*key/i,
    /\.pem$/i,
    /\.key$/i,
    /secret/i,
    /password/i,
    /token/i,
  ],
  risky_git_ops: [
    "git push --force",
    "git push -f",
    "git push --force-with-lease",
    "git reset --hard",
    "git rebase",
  ],
  // Allowlisted domains — warnings shown for non-allowlisted
  allowed_domains: [
    "github.com",
    "pypi.org",
    "npmjs.com",
    "files.pythonhosted.org",
    "registry.npmjs.org",
    "anthropic.com",
    "ppchat.vip",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ],
};

function extractDomain(url) {
  try {
    // Handle URLs with or without protocol
    let cleaned = url;
    if (!cleaned.match(/^https?:\/\//i)) {
      cleaned = "https://" + cleaned;
    }
    const urlObj = new URL(cleaned);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

function isSensitiveFile(filePath) {
  const basename = path.basename(filePath);
  const dirname = path.basename(path.dirname(filePath));

  // Check filename patterns
  for (const pattern of POLICY.sensitive_patterns) {
    if (pattern.test(basename) || pattern.test(dirname)) {
      return { sensitive: true, reason: `Matches sensitive pattern: ${pattern.source}` };
    }
  }

  // Check full path for common sensitive locations
  const lowerPath = filePath.toLowerCase();
  if (
    lowerPath.includes("\\.nadirclaw\\") ||
    lowerPath.includes("\\.claude\\") ||
    lowerPath.includes("credentials") ||
    lowerPath.includes("secrets")
  ) {
    return { sensitive: true, reason: "In sensitive directory location" };
  }

  return { sensitive: false };
}

function checkBashCommand(command) {
  const warnings = [];
  const trimmed = command.trim();

  // Check for dangerous commands
  for (const dangerous of POLICY.dangerous_commands) {
    if (trimmed.includes(dangerous)) {
      warnings.push({
        type: "dangerous_command",
        message: `Destructive command detected: "${dangerous}"`,
        risk: "HIGH",
      });
    }
  }

  // Check for network requests to unknown domains
  const curlMatch = trimmed.match(/curl\s+['"]?([^'"`\s]+)/i);
  const wgetMatch = trimmed.match(/wget\s+['"]?([^'"`\s]+)/i);
  const urlMatch = curlMatch || wgetMatch;

  if (urlMatch) {
    const domain = extractDomain(urlMatch[1]);
    if (domain) {
      const isAllowed = POLICY.allowed_domains.some((allowed) =>
        domain === allowed || domain.endsWith(`.${allowed}`)
      );

      if (!isAllowed) {
        warnings.push({
          type: "unknown_host",
          message: `Network request to unknown domain: ${domain}`,
          risk: "MEDIUM",
          domain,
        });
      }
    }
  }

  return warnings;
}

function checkGitOperation(command) {
  const warnings = [];
  const trimmed = command.trim();

  for (const risky of POLICY.risky_git_ops) {
    if (trimmed.includes(risky)) {
      warnings.push({
        type: "risky_git",
        message: `Risky git operation: "${risky}"`,
        risk: "HIGH",
      });
    }
  }

  return warnings;
}

function checkWriteOperation(filePath, content) {
  const warnings = [];

  const sensitiveCheck = isSensitiveFile(filePath);
  if (sensitiveCheck.sensitive) {
    // Only warn if content looks like actual data (not empty or template)
    if (content && content.length > 50 && !content.includes("YOUR_") && !content.includes("example")) {
      warnings.push({
        type: "sensitive_file",
        message: `Writing to sensitive file: ${path.basename(filePath)}`,
        reason: sensitiveCheck.reason,
        risk: "HIGH",
      });
    }
  }

  return warnings;
}

function checkFileOrganization(toolInput) {
  if (!["Write", "Edit", "Bash"].includes(toolInput.tool_name)) return;

  let filePath = "";
  if (toolInput.tool_name === "Write" || toolInput.tool_name === "Edit") {
    filePath = toolInput.tool_input?.file_path || "";
  } else if (toolInput.tool_name === "Bash") {
    const cmd = toolInput.tool_input?.command || "";
    const createMatch = cmd.match(/(?:touch|echo\s.*>|New-Item)\s+["']?(\S+)["']?/);
    if (createMatch) filePath = createMatch[1];
  }

  if (!filePath) return;

  const path = require("path");
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);

  const isRootLevel = dirname === "." || dirname === process.cwd() || filePath === basename;

  if (!isRootLevel) return;

  const suspiciousPatterns = [
    /^(plan|IMPLEMENT|TODO|NOTES|scratch|temp|tmp)\.md$/i,
    /^(debug|test_tmp|scratch|temp|tmp).*\.(py|js|ts|ps1|sh)$/i,
    /^.*\.ps1$/i,
  ];

  for (const p of suspiciousPatterns) {
    if (p.test(basename)) {
      console.error(`[FILE ORG] Creating "${basename}" in project root.`);
      console.error("Consider: docs/ for plans, tmp/ for temp scripts.");
      console.error("See file-organization.md rule for details.");
      return;
    }
  }
}

function main() {
  // Read input from stdin
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

  const toolName = toolInput.tool_name;
  const warnings = [];

  // Check based on tool type
  if (toolName === "Bash") {
    const command = toolInput.tool_input?.command || "";
    warnings.push(...checkBashCommand(command));

    // Also check git operations via Bash
    if (command.trim().startsWith("git ")) {
      warnings.push(...checkGitOperation(command));
    }
  } else if (toolName === "Write") {
    const filePath = toolInput.tool_input?.file_path || "";
    const content = toolInput.tool_input?.content || "";
    warnings.push(...checkWriteOperation(filePath, content));
  } else if (toolName === "Edit") {
    const filePath = toolInput.tool_input?.file_path || "";
    // Edit has new_string, not full content
    warnings.push(...checkWriteOperation(filePath, "x"));
  }

  checkFileOrganization(toolInput);

  // Output warnings
  if (warnings.length > 0) {
    console.error("\n=== ACTION GUARD WARNING ===");

    for (const warning of warnings) {
      console.error(`\n[${warning.risk} RISK] ${warning.type.toUpperCase()}`);
      console.error(`  ${warning.message}`);
      if (warning.reason) {
        console.error(`  Reason: ${warning.reason}`);
      }
      if (warning.domain) {
        console.error(`  Domain: ${warning.domain}`);
        console.error(`  Add to policies.allowed_domains if this is safe`);
      }
    }

    console.error("\nIf this is intentional, you may proceed.");
    console.error("===========================\n");
  }
}

main();
