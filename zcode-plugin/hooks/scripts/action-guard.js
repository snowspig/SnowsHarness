/**
 * Action Guard Hook (PreToolUse)
 *
 * Warns on risky operations before execution. Inspired by OpenHands-style
 * safety guardrails.
 *
 * Checks:
 * - Destructive shell commands (rm -rf, taskkill /F, docker rm, etc.)
 * - Sensitive file operations (.env, credentials, keys)
 * - Risky git operations (push --force, reset --hard)
 * - External network requests to unknown hosts
 *
 * This hook does NOT block — it only warns (via additionalContext, so the
 * model sees the warning and can reconsider).
 *
 * ZCode: warnings are emitted through stdout JSON (additionalContext), because
 * stderr is logged but never shown to the model.
 */

const fs = require("fs");
const path = require("path");
const { notify } = require("./_lib/zcode-output");

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
  allowed_domains: [
    "github.com",
    "pypi.org",
    "npmjs.com",
    "files.pythonhosted.org",
    "registry.npmjs.org",
    "anthropic.com",
    "bigmodel.cn",
    "z.ai",
    "zcode.z.ai",
    "ppchat.vip",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.8.1",
    "192.168.8.227",
  ],
};

function extractDomain(url) {
  try {
    let cleaned = url;
    if (!cleaned.match(/^https?:\/\//i)) cleaned = "https://" + cleaned;
    return new URL(cleaned).hostname;
  } catch {
    return null;
  }
}

function isSensitiveFile(filePath) {
  const basename = path.basename(filePath);
  const dirname = path.basename(path.dirname(filePath));
  for (const pattern of POLICY.sensitive_patterns) {
    if (pattern.test(basename) || pattern.test(dirname)) {
      return {
        sensitive: true,
        reason: `Matches sensitive pattern: ${pattern.source}`,
      };
    }
  }
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, "/");
  if (
    normalizedPath.includes("/.zcode/") ||
    normalizedPath.includes("/.claude/") ||
    normalizedPath.includes("credentials") ||
    normalizedPath.includes("secrets")
  ) {
    return { sensitive: true, reason: "In sensitive directory location" };
  }
  return { sensitive: false };
}

function checkBashCommand(command) {
  const warnings = [];
  const trimmed = command.trim();
  for (const dangerous of POLICY.dangerous_commands) {
    if (trimmed.includes(dangerous)) {
      warnings.push({
        type: "dangerous_command",
        message: `Destructive command detected: "${dangerous}"`,
        risk: "HIGH",
      });
    }
  }
  const curlMatch = trimmed.match(/curl\s+['"]?([^'"`\s]+)/i);
  const wgetMatch = trimmed.match(/wget\s+['"]?([^'"`\s]+)/i);
  const urlMatch = curlMatch || wgetMatch;
  if (urlMatch) {
    const domain = extractDomain(urlMatch[1]);
    if (domain) {
      const isAllowed = POLICY.allowed_domains.some(
        (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
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
    if (
      content &&
      content.length > 50 &&
      !content.includes("YOUR_") &&
      !content.includes("example")
    ) {
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
  if (!["Write", "Edit", "Bash"].includes(toolInput.tool_name)) return null;

  let filePath = "";
  if (toolInput.tool_name === "Write" || toolInput.tool_name === "Edit") {
    filePath = toolInput.tool_input?.file_path || "";
  } else if (toolInput.tool_name === "Bash") {
    const cmd = toolInput.tool_input?.command || "";
    const createMatch = cmd.match(
      /(?:touch|echo\s.*>|New-Item)\s+["']?(\S+)["']?/,
    );
    if (createMatch) filePath = createMatch[1];
  }
  if (!filePath) return null;

  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);
  const isRootLevel =
    dirname === "." || dirname === process.cwd() || filePath === basename;
  if (!isRootLevel) return null;

  const suspiciousPatterns = [
    /^(plan|IMPLEMENT|TODO|NOTES|scratch|temp|tmp)\.md$/i,
    /^(debug|test_tmp|scratch|temp|tmp).*\.(py|js|ts|ps1|sh)$/i,
  ];
  for (const p of suspiciousPatterns) {
    if (p.test(basename)) {
      return `"${basename}" 将创建在项目根目录。建议：计划文档放 docs/，临时脚本放 tmp/。`;
    }
  }
  return null;
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

  const toolName = toolInput.tool_name;
  const warnings = [];

  if (toolName === "Bash") {
    const command = toolInput.tool_input?.command || "";
    warnings.push(...checkBashCommand(command));
    if (command.trim().startsWith("git ")) {
      warnings.push(...checkGitOperation(command));
    }
  } else if (toolName === "Write") {
    const filePath = toolInput.tool_input?.file_path || "";
    const content = toolInput.tool_input?.content || "";
    warnings.push(...checkWriteOperation(filePath, content));
  } else if (toolName === "Edit") {
    const filePath = toolInput.tool_input?.file_path || "";
    warnings.push(...checkWriteOperation(filePath, "x"));
  }

  const orgWarn = checkFileOrganization(toolInput);

  if (warnings.length === 0 && !orgWarn) return;

  const lines = ["=== ⚠️ ACTION GUARD 警告 ==="];
  for (const w of warnings) {
    lines.push(`[${w.risk} RISK] ${w.type.toUpperCase()}: ${w.message}`);
    if (w.reason) lines.push(`  原因: ${w.reason}`);
    if (w.domain) lines.push(`  域名: ${w.domain}（若安全可加入白名单）`);
  }
  if (orgWarn) lines.push(`[FILE ORG] ${orgWarn}`);
  lines.push("如非故意，请停止并重新确认。");

  notify(lines.join("\n"));
}

main();
