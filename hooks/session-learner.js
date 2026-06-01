/**
 * Session Learner Hook (SessionEnd)
 *
 * Reads session logs, detects debug/fix/decision patterns, applies quality gate,
 * writes high-value insights to Memory Palace wings.
 *
 * Inspired by MemPalace's auto-save approach:
 * - 3 pattern categories: debug/fix, decisions, preferences
 * - Quality gate: not Googleable, codebase-specific, real effort
 * - Auto-creates wing structure on first write
 * - Respects file size limits to prevent unbounded growth
 *
 * Why: Claude has no cross-session memory. This compensates by mining
 * session transcripts for non-obvious insights that save future debugging time.
 * Remove when: Claude gains persistent, searchable session memory.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_PATTERN_LENGTH = 200;
const MAX_FACTS_LINES = 100;
const MAX_EVENTS_LINES = 100;
const MAX_PREFERENCES_LINES = 50;
const SESSION_LOG = path.join(os.homedir(), ".claude", "session-log.jsonl");
const TELEMETRY_LOG = path.join(
  os.homedir(),
  ".claude",
  "session-telemetry.jsonl",
);
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const projectSlug = projectDir
  .replace(/[\\/]/g, "-")
  .replace(/^-+/, "")
  .replace(/\/$/, "");
const MEMORY_DIR = path.join(
  os.homedir(),
  ".claude",
  "projects",
  projectSlug,
  "memory",
);
const LEARNER_LOG = path.join(os.homedir(), ".claude", ".learner-log.jsonl");

function readLastLines(filePath, maxLines = 500) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function parseSessionLog(lines) {
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip */
    }
  }
  return entries;
}

// ── Pattern Detection ──────────────────────────────────────────────

function detectDebugPatterns(entries) {
  const patterns = [];
  const fileReads = {};
  const fileEdits = {};
  let bashTestRuns = [];

  for (const entry of entries) {
    const tool = entry.tool_name || "";
    const input = entry.tool_input || {};
    const output = entry.tool_output || "";

    if (tool === "Read" || tool === "Grep" || tool === "Glob") {
      const fp = input.file_path || input.path || "";
      if (fp) fileReads[fp] = (fileReads[fp] || 0) + 1;
    }

    if (tool === "Edit" || tool === "Write") {
      const fp = input.file_path || input.path || "";
      if (fp) {
        fileEdits[fp] = (fileEdits[fp] || 0) + 1;
      }
    }

    if (tool === "Bash") {
      const cmd = input.command || "";
      if (
        /pytest|jest|vitest|mocha|cargo test|go test|ruff check|eslint|npm test/i.test(
          cmd,
        )
      ) {
        bashTestRuns.push({ cmd, output: (output || "").slice(0, 200) });
      }
    }
  }

  // Pattern 1: Heavily read file = debugging target
  for (const [fp, count] of Object.entries(fileReads)) {
    if (count >= 3) {
      patterns.push({
        type: "debug_target",
        file: fp,
        readCount: count,
        edited: fileEdits[fp] || 0,
        effort: count + (fileEdits[fp] || 0) * 2,
      });
    }
  }

  // Pattern 2: Edit after test failure = bug fix
  if (bashTestRuns.length > 0 && Object.keys(fileEdits).length > 0) {
    const testCmd = bashTestRuns[bashTestRuns.length - 1].cmd;
    const editedFiles = Object.keys(fileEdits);
    patterns.push({
      type: "bug_fix",
      testCommand: testCmd,
      editedFiles,
      effort: bashTestRuns.length + editedFiles.length * 2,
    });
  }

  // Pattern 3: Multiple edits to same file = iterative fix
  for (const [fp, count] of Object.entries(fileEdits)) {
    if (count >= 2) {
      patterns.push({
        type: "iterative_fix",
        file: fp,
        editCount: count,
        effort: count * 3,
      });
    }
  }

  return patterns;
}

/**
 * Detect decision patterns from user messages and assistant confirmations.
 * Inspired by MemPalace's "decision capture" — saves architecture choices,
 * config changes, and explicit user preferences expressed during conversation.
 */
function detectDecisionPatterns(entries) {
  const patterns = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const role = entry.role || "";
    const content = (entry.content || entry.tool_output || "").toLowerCase();

    // User expresses a preference or decision
    if (role === "user") {
      const decisionSignals = [
        /(?:always|never|must|should|don't|don't ever|make sure|from now on|ensure)/i,
        /(?:prefer|use|avoid|avoid using|stick to|stick with)/i,
        /(?:we(?:'re| are) (?:going|using|switching|migrating) (?:to|with|from))/i,
      ];
      if (decisionSignals.some((r) => r.test(content))) {
        // Get context: next 2 assistant messages
        const context = [];
        for (let j = i + 1; j < Math.min(i + 3, entries.length); j++) {
          if (entries[j].role === "assistant" || entries[j].tool_name) {
            const snippet = (entries[j].content || "").slice(0, 150);
            if (snippet) context.push(snippet);
          }
        }
        patterns.push({
          type: "user_decision",
          content: content.slice(0, MAX_PATTERN_LENGTH),
          context: context.join(" | "),
          effort: 3, // Decisions are always worth at least 3
        });
      }
    }
  }

  return patterns;
}

// ── Quality Gate ───────────────────────────────────────────────────

function applyQualityGate(pattern) {
  if (pattern.effort < 4) return null;

  const fp = pattern.file || "";
  const genericPaths = ["node_modules", "site-packages", ".git", "__pycache__"];
  if (genericPaths.some((p) => fp.includes(p))) return null;

  // For file-based patterns, require home directory context
  if (fp && !fp.includes(os.homedir())) return null;

  return pattern;
}

// ── Wing Routing ───────────────────────────────────────────────────

function guessWing(filePath) {
  const fp = filePath.toLowerCase();
  if (
    fp.includes("snowsrouter") ||
    fp.includes("routing") ||
    fp.includes("ppchat")
  )
    return "snowsrouter";
  if (
    fp.includes("qlib") ||
    fp.includes("xtquant") ||
    fp.includes("quantbox") ||
    fp.includes("factor")
  )
    return "quant";
  if (fp.includes(".claude") || fp.includes("hook") || fp.includes("memory"))
    return "claude-code";
  if (fp.includes("docker") || fp.includes("deploy") || fp.includes("nginx"))
    return "devops";
  return "general";
}

// ── Fact Formatting ────────────────────────────────────────────────

function formatFact(pattern) {
  const now = new Date().toISOString().slice(0, 10);
  switch (pattern.type) {
    case "debug_target":
      return {
        title: `Debug hotspot: ${path.basename(pattern.file)}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- File ${pattern.file} was read ${pattern.readCount}x and edited ${pattern.edited}x in one session`,
          `- Likely contains non-obvious behavior that required investigation`,
        ].join("\n"),
        wing: guessWing(pattern.file),
        type: "fact",
      };
    case "bug_fix":
      return {
        title: `Bug fix: ${pattern.editedFiles.map((f) => path.basename(f)).join(", ")}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- Test: \`${pattern.testCommand}\``,
          `- Fixed by editing: ${pattern.editedFiles.join(", ")}`,
          `- Required ${pattern.effort} total tool interactions to resolve`,
        ].join("\n"),
        wing: guessWing(pattern.editedFiles[0] || ""),
        type: "fact",
      };
    case "iterative_fix":
      return {
        title: `Iterative fix: ${path.basename(pattern.file)}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- File ${pattern.file} required ${pattern.editCount} edits in one session`,
          `- Suggests the fix was non-trivial or had side effects`,
        ].join("\n"),
        wing: guessWing(pattern.file),
        type: "fact",
      };
    case "user_decision":
      return {
        title: `Decision: ${pattern.content.slice(0, 60).replace(/\n/g, " ")}...`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- User stated: "${pattern.content.slice(0, 150).replace(/\n/g, " ")}"`,
          pattern.context ? `- Context: ${pattern.context.slice(0, 150)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        wing: "general",
        type: "preference",
      };
    default:
      return null;
  }
}

// ── Persistence ────────────────────────────────────────────────────

function ensureWingStructure(wingName) {
  const wingDir = path.join(MEMORY_DIR, "wings", wingName);
  if (!fs.existsSync(wingDir)) {
    fs.mkdirSync(wingDir, { recursive: true });
  }
  // Ensure standard files exist
  const standardFiles = {
    "facts.md": `# ${wingName} Facts\n\n`,
    "events.md": `# ${wingName} Events\n\n`,
    "preferences.md": `# ${wingName} Preferences\n\n`,
    "README.md": [
      `# Wing: ${wingName}`,
      "",
      "## Keywords",
      wingName,
      "",
      "## Summary",
      `_Auto-created by session-learner._`,
      "",
    ].join("\n"),
  };
  for (const [file, defaultContent] of Object.entries(standardFiles)) {
    const fp = path.join(wingDir, file);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, defaultContent, "utf-8");
    }
  }
  return wingDir;
}

function getFileLineCount(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}

function writeFactToWing(fact) {
  if (!fact) return;

  const wingDir = ensureWingStructure(fact.wing);
  const targetFile =
    fact.type === "preference"
      ? path.join(wingDir, "preferences.md")
      : path.join(wingDir, "facts.md");
  const lineLimit =
    fact.type === "preference" ? MAX_PREFERENCES_LINES : MAX_FACTS_LINES;

  // Check line limit
  const existingLines = getFileLineCount(targetFile);
  if (existingLines >= lineLimit) {
    logLearnerAction(
      "skip",
      `${path.basename(targetFile)} at ${existingLines} lines (limit ${lineLimit})`,
    );
    return;
  }

  // Read existing and check for duplicate
  let existing = "";
  try {
    existing = fs.readFileSync(targetFile, "utf-8");
  } catch {
    /* new file */
  }
  if (existing.includes(fact.title)) {
    logLearnerAction("skip", `duplicate: ${fact.title}`);
    return;
  }

  // Append fact
  const entry = `\n## ${fact.title}\n${fact.content}\n`;
  fs.appendFileSync(targetFile, entry, "utf-8");

  // Update MEMORY.md wing table if it exists
  updateMemoryMd(fact.wing);

  // Log to changelog
  appendChangelog(`Added ${fact.type}: ${fact.title} → ${fact.wing}`);

  logLearnerAction(
    "write",
    `${fact.wing}/${path.basename(targetFile)} + ${fact.title}`,
  );
}

function updateMemoryMd(wingName) {
  const memoryMd = path.join(MEMORY_DIR, "MEMORY.md");
  if (!fs.existsSync(memoryMd)) return;

  try {
    let content = fs.readFileSync(memoryMd, "utf-8");

    // Count entries in the wing
    const wingDir = path.join(MEMORY_DIR, "wings", wingName);
    const factsFile = path.join(wingDir, "facts.md");
    let entryCount = 0;
    if (fs.existsSync(factsFile)) {
      const factsContent = fs.readFileSync(factsFile, "utf-8");
      entryCount = (factsContent.match(/^## /gm) || []).length - 1; // subtract heading
    }
    if (entryCount < 0) entryCount = 0;

    const today = new Date().toISOString().split("T")[0];

    // Update or add wing row in table
    const wingRow = `| ${wingName} | ${entryCount} | ${today} |`;
    const wingRowRegex = new RegExp(`^\\| ${wingName} \\|.*\\|`, "m");

    if (wingRowRegex.test(content)) {
      content = content.replace(wingRowRegex, wingRow);
    } else {
      // Add after table header separator
      content = content.replace(
        /\|------\|.*\|\n/,
        `|------|---------|--------------|----------|\n${wingRow} |\n`,
      );
    }

    fs.writeFileSync(memoryMd, content, "utf-8");
  } catch {
    /* silent */
  }
}

function appendChangelog(message) {
  const changelog = path.join(MEMORY_DIR, "_meta", "changelog.md");
  try {
    const today = new Date().toISOString().split("T")[0];
    let content = "";
    if (fs.existsSync(changelog)) {
      content = fs.readFileSync(changelog, "utf-8");
    } else {
      fs.mkdirSync(path.dirname(changelog), { recursive: true });
      content = "# Memory Changelog\n\n";
    }

    // Check if today's section exists
    if (content.includes(`## ${today}`)) {
      content = content.replace(`## ${today}\n`, `## ${today}\n- ${message}\n`);
    } else {
      content += `\n## ${today}\n- ${message}\n`;
    }

    fs.writeFileSync(changelog, content, "utf-8");
  } catch {
    /* silent */
  }
}

function logLearnerAction(action, detail) {
  const entry =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      detail,
    }) + "\n";
  try {
    fs.appendFileSync(LEARNER_LOG, entry, "utf-8");
  } catch {
    /* silent */
  }
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  try {
    // Ensure base memory structure exists
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(path.join(MEMORY_DIR, "wings"), { recursive: true });
      fs.mkdirSync(path.join(MEMORY_DIR, "_meta"), { recursive: true });
    }

    // Read recent session entries
    const lines = readLastLines(SESSION_LOG, 500);
    if (lines.length === 0) return;

    const entries = parseSessionLog(lines);
    if (entries.length === 0) return;

    // Detect patterns from multiple categories
    const debugPatterns = detectDebugPatterns(entries);
    const decisionPatterns = detectDecisionPatterns(entries);
    const allPatterns = [...debugPatterns, ...decisionPatterns];

    // Apply quality gate and write
    let written = 0;
    for (const pattern of allPatterns) {
      const filtered = applyQualityGate(pattern);
      if (!filtered) continue;

      const fact = formatFact(filtered);
      if (!fact) continue;

      writeFactToWing(fact);
      written++;
    }

    if (written > 0) {
      logLearnerAction(
        "summary",
        `Extracted ${written} insight(s) from ${entries.length} entries (${debugPatterns.length} debug + ${decisionPatterns.length} decision patterns)`,
      );
    }
  } catch (e) {
    logLearnerAction("error", e.message);
  }
}

main();
