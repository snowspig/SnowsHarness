#!/usr/bin/env node
/**
 * Memory Emergency Save Hook (PreCompact)
 *
 * Fires RIGHT BEFORE Claude Code compacts the conversation.
 * Scans the current session for unsaved insights and writes them
 * to the Memory Palace before they're lost to compression.
 *
 * Inspired by MemPalace's precompact hook — the key insight being
 * that compaction is the highest-risk moment for memory loss.
 *
 * Why: Compaction discards conversation context. Any insights gathered
 * during the session that haven't been explicitly saved are lost.
 * This hook ensures high-value patterns are persisted before that happens.
 * Remove when: Claude gains native persistent memory that survives compaction.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

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

function log(action, detail) {
  const entry =
    JSON.stringify({ timestamp: new Date().toISOString(), action, detail }) +
    "\n";
  try {
    fs.appendFileSync(LEARNER_LOG, entry, "utf-8");
  } catch {
    /* silent */
  }
}

function ensureWingStructure(wingName) {
  const wingDir = path.join(MEMORY_DIR, "wings", wingName);
  if (!fs.existsSync(wingDir)) {
    fs.mkdirSync(wingDir, { recursive: true });
  }
  return wingDir;
}

function main() {
  try {
    // Read stdin — PreCompact hook receives current conversation summary
    let input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        const messages = data.messages || data.conversation || [];
        if (!messages.length) {
          log("precompact", "No messages found — skipping");
          return;
        }

        // Count human messages as a proxy for session length
        const humanMessages = messages.filter(
          (m) => m.role === "user" && (m.content || "").trim().length > 10,
        ).length;

        if (humanMessages < 3) {
          log(
            "precompact",
            `Only ${humanMessages} human messages — nothing to save`,
          );
          return;
        }

        // Scan for unsaved decision patterns
        const decisions = [];
        const userContent = messages
          .filter((m) => m.role === "user")
          .map((m) => (m.content || "").toLowerCase());

        const decisionSignals = [
          /(?:always|never|must|should|make sure|from now on|ensure)/i,
          /(?:prefer|use|avoid|stick to|switching|migrating)/i,
        ];

        for (const content of userContent) {
          if (decisionSignals.some((r) => r.test(content))) {
            decisions.push(content.slice(0, 150));
          }
        }

        if (decisions.length === 0) {
          log(
            "precompact",
            `${humanMessages} messages, 0 decisions — nothing to save`,
          );
          return;
        }

        // Write decisions to general wing
        const wingDir = ensureWingStructure("general");
        const prefsFile = path.join(wingDir, "preferences.md");
        const now = new Date().toISOString().slice(0, 10);

        let existing = "";
        try {
          existing = fs.readFileSync(prefsFile, "utf-8");
        } catch {
          /* new */
        }

        let written = 0;
        for (const decision of decisions) {
          const title = `Decision: ${decision.slice(0, 60).replace(/\n/g, " ")}...`;
          if (existing.includes(title)) continue; // dedup

          const entry = `\n## ${title}\n- **Date**: ${now} | **Status**: active\n- Expressed before compaction: "${decision.replace(/\n/g, " ")}"\n`;
          fs.appendFileSync(prefsFile, entry, "utf-8");
          written++;
        }

        if (written > 0) {
          log(
            "precompact",
            `Emergency-saved ${written} decision(s) before compaction`,
          );
        }
      } catch (e) {
        log("precompact-error", e.message);
      }
    });
  } catch (e) {
    log("precompact-error", e.message);
  }
}

main();
