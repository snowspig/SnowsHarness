/**
 * Suggest Compact Hook (PostToolUse)
 *
 * Tracks tool call count via a temp file and suggests /compact
 * at logical boundaries after 80+ calls.
 *
 * Never interrupts mid-task — only outputs a suggestion.
 *
 * Remove when: Claude Code's built-in compaction becomes fully automatic.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const CALL_THRESHOLD = 80;
const COUNTER_FILE = path.join(os.tmpdir(), "claude-tool-call-counter.json");

function readCounter() {
  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8"));
  } catch {
    return { count: 0, suggested: false, sessionId: "" };
  }
}

function writeCounter(data) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(data));
  } catch {
    // Silently fail — this is non-critical
  }
}

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  const counter = readCounter();

  // Reset if new session
  const sessionId = process.env.CLAUDE_SESSION_ID || "default";
  if (counter.sessionId !== sessionId) {
    counter.count = 0;
    counter.suggested = false;
    counter.sessionId = sessionId;
  }

  counter.count++;

  if (counter.count >= CALL_THRESHOLD && !counter.suggested) {
    counter.suggested = true;
    writeCounter(counter);
    console.error(`\n[COMPACT SUGGESTION] ${counter.count} tool calls in this session.`);
    console.error("Consider running /compact at the next natural break (after commit, test pass, etc.).");
    console.error("This will free context window space for continued work.\n");
    return;
  }

  writeCounter(counter);
}

main();
