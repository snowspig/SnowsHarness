/**
 * Session End Hook
 *
 * On session end, writes structured telemetry for routing and workflow analysis.
 * Also maintains backward-compatible session-log.jsonl.
 *
 * Inspired by OpenHarness closed-loop feedback concept.
 */

const fs = require("fs");
const path = require("path");

const HOME = process.env.USERPROFILE || process.env.HOME;
const CLAUDE_DIR = path.join(HOME, ".claude");
const LEGACY_LOG = path.join(CLAUDE_DIR, "session-log.jsonl");
const TELEMETRY_LOG = path.join(CLAUDE_DIR, "session-telemetry.jsonl");

// Health cache written by session-start.js
const HEALTH_CACHE = path.join(HOME, ".claude", ".session-health-cache.json");

function loadHealthCache() {
  try {
    return JSON.parse(fs.readFileSync(HEALTH_CACHE, "utf8"));
  } catch {
    return { nadirclaw: null, vllm: null, checked_at: null };
  }
}

function detectProjectType(projectDir) {
  if (!projectDir) return "unknown";
  const lower = projectDir.toLowerCase().replace(/\\/g, "/");
  if (/qlib|quant|trading|strategy|xtquant|quantbox/.test(lower)) return "quant";
  if (/nadirclaw|\.nadirclaw/.test(lower)) return "nadirclaw";
  if (/next|react|vue|tailwind|frontend/.test(lower)) return "frontend";
  if (/api|server|backend/.test(lower)) return "backend";
  return "general";
}

function main() {
  const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sessionId = process.env.CLAUDE_SESSION_ID || "unknown";
  const now = new Date().toISOString();

  const health = loadHealthCache();
  const projectType = detectProjectType(project);

  // Legacy log (backward compatible)
  const legacy = { timestamp: now, project, session_id: sessionId };
  try {
    fs.appendFileSync(LEGACY_LOG, JSON.stringify(legacy) + "\n", "utf8");
  } catch { /* silent */ }

  // Structured telemetry
  const telemetry = {
    timestamp: now,
    project,
    session_id: sessionId,
    project_type: projectType,
    nadirclaw_healthy: health.nadirclaw,
    vllm_healthy: health.vllm,
    health_checked_at: health.checked_at,
  };

  try {
    fs.appendFileSync(TELEMETRY_LOG, JSON.stringify(telemetry) + "\n", "utf8");
  } catch { /* silent */ }
}

main();
