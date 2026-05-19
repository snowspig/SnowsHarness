# Local Claude Code Harness Enhancement - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the global Claude Code harness with new rules, hooks, commands, and agents while preserving existing functionality.

**Architecture:** Layer 1 (Rules) adds behavioral guidance in markdown. Layer 2 (Hooks) adds mechanical safety nets in JS. Layer 3 (Commands/Agents) adds on-demand capabilities with zero resident token cost. Modifications to existing hooks are surgical — only the specific changes listed.

**Tech Stack:** Node.js (hooks), Markdown (rules/commands/agents), JSON (settings)

**Target directory:** `C:\Users\Tao\.claude\`

---

## File Structure

### New files to create:
| File | Purpose |
|------|---------|
| `rules/common/collaboration.md` | Collaboration principles + state persistence |
| `rules/common/file-organization.md` | Prevent root directory pollution |
| `rules/common/code-review.md` | Review severity triage matrix |
| `rules/harness-quality.md` | Harness self-audit / decommission criteria |
| `hooks/config-protection.js` | Block config file edits |
| `hooks/change-safety.js` | Detect stale-context edits |
| `hooks/suggest-compact.js` | Suggest /compact at logical boundaries |
| `hooks/batch-format.js` | Stop-time batch formatting |
| `commands/build-fix.md` | Build error diagnosis slash command |
| `commands/context-audit.md` | Token budget audit slash command |
| `commands/commit-push-pr.md` | Commit + push + PR workflow command |
| `commands/harness-check.md` | Harness health check command |
| `agents/build-error-resolver.md` | Build error subagent |
| `agents/security-reviewer.md` | OWASP security subagent |
| `agents/test-runner.md` | Test execution subagent |
| `agents/docs-generator.md` | Documentation subagent |

### Existing files to modify:
| File | Change |
|------|--------|
| `hooks/action-guard.js` | Add file organization check for root-level files |
| `hooks/session-learner.js` | Replace hardcoded path with `CLAUDE_PROJECT_DIR` env var |
| `hooks/hooks.json` | Add new hook entries |

---

## Task 1: Rules — collaboration.md

**Files:**
- Create: `C:\Users\Tao\.claude\rules\common\collaboration.md`

- [ ] **Step 1: Create the file**

```markdown
## Collaboration Principles

Start from the original requirement and root problem, not from conventions or templates:
- Do not assume the user knows exactly what they want — when motivation or goal
  is unclear, stop and discuss
- When the goal is clear but the chosen path is suboptimal — say so directly and
  suggest a better approach
- Always trace issues to root cause; never paper over problems — but match rigor
  to context (production code demands root cause; throwaway scripts need only work)
- Every decision must answer "why"
- Output only what changes decisions — cut everything else

## State Persistence

Persist state as it happens, not at context boundaries:
- When a task completes, a decision is made, or a correction occurs, write it to
  CLAUDE.md or memory immediately
- Before starting complex work, write current progress and next steps to
  .claude/plan.md so that context loss from /compact or session restart does not
  reset progress
```

- [ ] **Step 2: Verify file exists and content is correct**

Run: `node -e "const f=require('fs').readFileSync('C:/Users/Tao/.claude/rules/common/collaboration.md','utf8'); console.log(f.length > 100 ? 'OK: ' + f.length + ' chars' : 'FAIL: too short')"`

Expected: `OK: XXX chars` (should be ~500+)

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add collaboration principles rule"
```

---

## Task 2: Rules — file-organization.md

**Files:**
- Create: `C:\Users\Tao\.claude\rules\common\file-organization.md`

- [ ] **Step 1: Create the file**

```markdown
## File Organization

Never create loose files in the project root.

Working files placement:
- Plans, specs, design docs → docs/ directory
- Temporary scripts (.py, .ps1, .sh for quick testing) → tmp/ directory
- Generated code → appropriate src/ or project subdirectory

Cleanup rules:
- Files in tmp/ are disposable — clean up when the task is complete
- Never leave debug_*, test_*, or ad-hoc .ps1/.py scripts in the project root

If unsure where a file belongs, ask before creating it.
```

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('fs').existsSync('C:/Users/Tao/.claude/rules/common/file-organization.md') ? 'OK' : 'FAIL')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add file organization rule"
```

---

## Task 3: Rules — code-review.md

**Files:**
- Create: `C:\Users\Tao\.claude\rules\common\code-review.md`

- [ ] **Step 1: Create the file**

```markdown
## Code Review Standards

When reviewing code, classify every finding by severity:

- **Blocker**: Will cause failures in production (security holes, data loss, crashes)
- **High**: Likely to cause problems soon (race conditions, missing error handling)
- **Medium**: Should be fixed but not urgent (code smells, missing tests, naming)
- **Nitpick**: Style preferences, minor readability improvements

Every finding must include: file path, line number, what's wrong, why it matters,
and a suggested fix. No finding without evidence.
```

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('fs').existsSync('C:/Users/Tao/.claude/rules/common/code-review.md') ? 'OK' : 'FAIL')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add code review severity matrix rule"
```

---

## Task 4: Rules — harness-quality.md

**Files:**
- Create: `C:\Users\Tao\.claude\rules\harness-quality.md`

- [ ] **Step 1: Create the file**

```markdown
## Harness Quality

Every harness component (hook, rule, agent, command) should document:
- Why it exists (what model limitation it compensates for)
- What capability improvement would make it unnecessary

Review this file every 3 months or after major model upgrades.
Remove components that no longer provide value — fewer moving parts = fewer failures.
```

- [ ] **Step 2: Verify**

Run: `node -e "console.log(require('fs').existsSync('C:/Users/Tao/.claude/rules/harness-quality.md') ? 'OK' : 'FAIL')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add harness self-audit quality rule"
```

---

## Task 5: Hook — config-protection.js

**Files:**
- Create: `C:\Users\Tao\.claude\hooks\config-protection.js`

- [ ] **Step 1: Create the file**

```javascript
/**
 * Config Protection Hook (PreToolUse)
 *
 * Blocks modifications to tool/linter config files.
 * Prevents the "fix the linter to satisfy the code" anti-pattern.
 *
 * Whitelist: CLAUDE.md, .claude/*, memory/* — Claude may modify these.
 *
 * Remove when: Claude reliably fixes code instead of weakening configs.
 */

const fs = require("fs");
const path = require("path");

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
  /CLAUDE\.md$/i,
  /\\.claude[\\/]/,
  /memory[\\/]/,
  /\\.claude\\.md$/i,
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
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  if (!filePath) return;

  if (isBlocked(filePath)) {
    const basename = path.basename(filePath);
    console.error(`[CONFIG PROTECTION] Blocked modification of ${basename}`);
    console.error("Fix the code to satisfy the linter, not the linter to accept the code.");
    console.error("If this change is intentional, run the command again with explicit approval.");
    process.exit(2);
  }
}

main();
```

- [ ] **Step 2: Test with simulated input**

Run: `echo '{"tool_name":"Edit","tool_input":{"file_path":"C:/project/.eslintrc.json","old_string":"x","new_string":"y"}}' | node C:/Users/Tao/.claude/hooks/config-protection.js`

Expected: Exit code 2, prints `[CONFIG PROTECTION] Blocked modification of .eslintrc.json`

- [ ] **Step 3: Test whitelist — CLAUDE.md should pass**

Run: `echo '{"tool_name":"Edit","tool_input":{"file_path":"C:/project/CLAUDE.md","old_string":"x","new_string":"y"}}' | node C:/Users/Tao/.claude/hooks/config-protection.js`

Expected: Exit code 0, no output

- [ ] **Step 4: Test whitelist — .claude/ should pass**

Run: `echo '{"tool_name":"Write","tool_input":{"file_path":"C:/project/.claude/settings.json","content":"{}"}}' | node C:/Users/Tao/.claude/hooks/config-protection.js`

Expected: Exit code 0, no output

- [ ] **Step 5: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add config protection hook"
```

---

## Task 6: Hook — change-safety.js

**Files:**
- Create: `C:\Users\Tao\.claude\hooks\change-safety.js`

- [ ] **Step 1: Create the file**

```javascript
/**
 * Change Safety Hook (PreToolUse)
 *
 * Prevents Edit operations based on stale context by verifying
 * that old_string still matches the current file content.
 *
 * Remove when: Claude always reads files before editing, or context
 * windows grow large enough that stale context is rare.
 */

const fs = require("fs");

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  if (toolInput.tool_name !== "Edit") return;

  const filePath = toolInput.tool_input?.file_path || "";
  const oldString = toolInput.tool_input?.old_string || "";

  if (!filePath || !oldString) return;

  let currentContent;
  try {
    currentContent = fs.readFileSync(filePath, "utf8");
  } catch {
    return; // File doesn't exist yet — that's fine for new files
  }

  if (!currentContent.includes(oldString)) {
    console.error(`[CHANGE SAFETY] Edit old_string does not match current file content.`);
    console.error(`File: ${filePath}`);
    console.error(`The file may have changed since it was last read.`);
    console.error(`Action: Read the file first, then retry the edit with the current content.`);
    process.exit(2);
  }
}

main();
```

- [ ] **Step 2: Test with matching content**

Run: `echo '{"tool_name":"Edit","tool_input":{"file_path":"C:/Users/Tao/.claude/hooks/hooks.json","old_string":"SessionStart","new_string":"SessionStart"}}' | node C:/Users/Tao/.claude/hooks/change-safety.js`

Expected: Exit code 0 (hooks.json contains "SessionStart")

- [ ] **Step 3: Test with non-matching content**

Run: `echo '{"tool_name":"Edit","tool_input":{"file_path":"C:/Users/Tao/.claude/hooks/hooks.json","old_string":"THIS_STRING_DOES_NOT_EXIST_ANYWHERE","new_string":"x"}}' | node C:/Users/Tao/.claude/hooks/change-safety.js`

Expected: Exit code 2, prints `[CHANGE SAFETY]` message

- [ ] **Step 4: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add change safety hook to prevent stale-context edits"
```

---

## Task 7: Hook — suggest-compact.js

**Files:**
- Create: `C:\Users\Tao\.claude\hooks\suggest-compact.js`

- [ ] **Step 1: Create the file**

```javascript
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
```

- [ ] **Step 2: Test counter increment**

Run: `echo '{"tool_name":"Read","tool_input":{}}' | node C:/Users/Tao/.claude/hooks/suggest-compact.js && echo "Exit: $?"`

Expected: Exit code 0, no output (first call, counter = 1)

- [ ] **Step 3: Test threshold trigger — set counter near threshold**

Run: `node -e "require('fs').writeFileSync(require('os').tmpdir() + '/claude-tool-call-counter.json', JSON.stringify({count:79,suggested:false,sessionId:'default'}))" && echo '{"tool_name":"Read","tool_input":{}}' | node C:/Users/Tao/.claude/hooks/suggest-compact.js`

Expected: Prints `[COMPACT SUGGESTION] 80 tool calls...`

- [ ] **Step 4: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add compact suggestion hook"
```

---

## Task 8: Hook — batch-format.js

**Files:**
- Create: `C:\Users\Tao\.claude\hooks\batch-format.js`

- [ ] **Step 1: Create the file**

```javascript
/**
 * Batch Format Hook (Stop)
 *
 * Collects all files written/edited during the session (tracked via temp file)
 * and batch-runs prettier/ruff format once at session end.
 *
 * Does NOT run after every Edit — that's post-write-verify.js's job.
 *
 * Remove when: post-write-verify.js handles formatting adequately,
 * or formatting is fully automated by the editor.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const TRACKER_FILE = path.join(os.tmpdir(), "claude-written-files.json");

function getWrittenFiles() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch {
    return [];
  }
}

function clearTracker() {
  try { fs.unlinkSync(TRACKER_FILE); } catch { /* ignore */ }
}

function formatFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) return null;

  try {
    if ([".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".scss", ".html", ".md"].includes(ext)) {
      execSync(`npx prettier --write "${absPath}"`, { timeout: 10000, stdio: "pipe" });
      return "prettier";
    }
    if ([".py"].includes(ext)) {
      execSync(`ruff format "${absPath}"`, { timeout: 10000, stdio: "pipe" });
      return "ruff";
    }
  } catch {
    return "error";
  }
  return null;
}

function main() {
  const files = getWrittenFiles();
  if (files.length === 0) return;

  const results = { prettier: 0, ruff: 0, skipped: 0, errors: 0 };

  for (const filePath of files) {
    const result = formatFile(filePath);
    if (result === "prettier") results.prettier++;
    else if (result === "ruff") results.ruff++;
    else if (result === "error") results.errors++;
    else results.skipped++;
  }

  const total = results.prettier + results.ruff;
  if (total > 0) {
    console.error(`[BATCH FORMAT] Formatted ${total} files (prettier: ${results.prettier}, ruff: ${results.ruff})`);
  }
  if (results.errors > 0) {
    console.error(`[BATCH FORMAT] ${results.errors} files had formatting errors`);
  }

  clearTracker();
}

main();
```

- [ ] **Step 2: Test with no tracked files (clean run)**

Run: `echo '{}' | node C:/Users/Tao/.claude/hooks/batch-format.js`

Expected: Exit code 0, no output

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add batch format hook for stop-time formatting"
```

---

## Task 9: Hook — written file tracker (companion to batch-format)

**Files:**
- Create: `C:\Users\Tao\.claude\hooks\track-written-files.js`

- [ ] **Step 1: Create the file**

This companion hook runs on PostToolUse (Write|Edit) and tracks which files were modified so batch-format.js can process them at Stop.

```javascript
/**
 * Written File Tracker (PostToolUse)
 *
 * Tracks files written/edited during a session for batch-format.js
 * to process at Stop. Companion hook — do not use standalone.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const TRACKER_FILE = path.join(os.tmpdir(), "claude-written-files.json");

function main() {
  let input = "";
  try { input = fs.readFileSync(0, "utf8"); } catch { return; }

  let toolInput;
  try { toolInput = JSON.parse(input); } catch { return; }

  if (!["Write", "Edit"].includes(toolInput.tool_name)) return;

  const filePath = toolInput.tool_input?.file_path || "";
  if (!filePath) return;

  let files = [];
  try {
    files = JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
  } catch { /* first write */ }

  if (!files.includes(filePath)) {
    files.push(filePath);
  }

  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(files));
  } catch { /* silently fail */ }
}

main();
```

- [ ] **Step 2: Test tracking**

Run: `echo '{"tool_name":"Write","tool_input":{"file_path":"C:/project/test.py","content":"x=1"}}' | node C:/Users/Tao/.claude/hooks/track-written-files.js && node -e "console.log(JSON.parse(require('fs').readFileSync(require('os').tmpdir()+'/claude-written-files.json','utf8')))"`

Expected: `["C:/project/test.py"]`

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add written file tracker hook (companion to batch-format)"
```

---

## Task 10: Modify — action-guard.js (add file organization check)

**Files:**
- Modify: `C:\Users\Tao\.claude\hooks\action-guard.js`

- [ ] **Step 1: Add file organization check after existing destructive command checks**

Find the end of the existing checks (before the `main()` function or before the final section), and add this function and integration:

```javascript
// Add this function before main()

function checkFileOrganization(toolInput) {
  if (!["Write", "Edit", "Bash"].includes(toolInput.tool_name)) return;

  let filePath = "";
  if (toolInput.tool_name === "Write" || toolInput.tool_name === "Edit") {
    filePath = toolInput.tool_input?.file_path || "";
  } else if (toolInput.tool_name === "Bash") {
    // Detect file creation in bash commands
    const cmd = toolInput.tool_input?.command || "";
    const createMatch = cmd.match(/(?:touch|echo\s.*>|New-Item)\s+["']?(\S+)["']?/);
    if (createMatch) filePath = createMatch[1];
  }

  if (!filePath) return;

  const path = require("path");
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);

  // Only warn about root-level files
  const isRootLevel = dirname === "." || dirname === process.cwd() || filePath === basename;

  if (!isRootLevel) return;

  const suspiciousPatterns = [
    /^(plan|IMPLEMENT|TODO|NOTES|scratch|temp|tmp)\.md$/i,
    /^(debug|test_tmp|scratch|temp|tmp).*\.(py|js|ts|ps1|sh)$/i,
    /^.*\.ps1$/i, // PowerShell scripts should not be in root
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

// In main(), add this call after existing checks pass:
// checkFileOrganization(toolInput);
```

The exact integration point depends on the current structure. The implementer should add the `checkFileOrganization(toolInput)` call inside `main()` after the existing guard checks, before the function returns.

- [ ] **Step 2: Verify the modified hook still works**

Run: `echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node C:/Users/Tao/.claude/hooks/action-guard.js`

Expected: Existing destructive command warning still fires

- [ ] **Step 3: Verify new file org check**

Run: `echo '{"tool_name":"Write","tool_input":{"file_path":"plan.md","content":"test"}}' | node C:/Users/Tao/.claude/hooks/action-guard.js`

Expected: `[FILE ORG] Creating "plan.md" in project root.`

- [ ] **Step 4: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add file organization warning to action-guard hook"
```

---

## Task 11: Modify — session-learner.js (fix hardcoded path)

**Files:**
- Modify: `C:\Users\Tao\.claude\hooks\session-learner.js`

- [ ] **Step 1: Replace hardcoded path with dynamic detection**

Find the hardcoded `D--Quant-claudecode` path reference and replace with:

```javascript
// Replace hardcoded project path with dynamic detection
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const projectSlug = projectDir.replace(/[:\\\/]/g, "-").replace(/^-+/, "");
```

Then replace all references to the hardcoded slug with `projectSlug`.

- [ ] **Step 2: Verify hook still runs without error**

Run: `echo '{"tool_name":"test"}' | node C:/Users/Tao/.claude/hooks/session-learner.js`

Expected: Exit code 0 (no crash)

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "fix: replace hardcoded path with CLAUDE_PROJECT_DIR in session-learner"
```

---

## Task 12: Update — hooks.json (register new hooks)

**Files:**
- Modify: `C:\Users\Tao\.claude\hooks\hooks.json`

- [ ] **Step 1: Add new hook entries**

Merge the following into the existing hooks.json structure. Keep all existing entries, add new ones to the appropriate event arrays:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/session-start.js"],
        "description": "Load project context and show environment status on session start"
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/config-protection.js"],
        "description": "Block modifications to tool config files (eslint, prettier, tsconfig, etc.)"
      },
      {
        "matcher": "Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/change-safety.js"],
        "description": "Prevent edits based on stale context that overwrite recent changes"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/secret-detect.js"],
        "description": "Detect sensitive information in written files"
      },
      {
        "matcher": "Write|Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/track-written-files.js"],
        "description": "Track written files for batch formatting at session end"
      },
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/suggest-compact.js"],
        "description": "Suggest /compact after 80+ tool calls at logical boundaries"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/batch-format.js"],
        "description": "Batch format all files written during the session"
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/session-end.js"],
        "description": "Log session summary for learning"
      }
    ]
  }
}
```

Note: The existing hooks (action-guard, output-size-warning, post-write-verify, project-context, session-learner) are registered in `settings.json` not `hooks.json`. Check `settings.json` for the complete hook registration and merge accordingly.

- [ ] **Step 2: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('C:/Users/Tao/.claude/hooks/hooks.json','utf8')); console.log('JSON valid')"`

Expected: `JSON valid`

- [ ] **Step 3: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: register new hooks in hooks.json"
```

---

## Task 13: Command — build-fix.md

**Files:**
- Create: `C:\Users\Tao\.claude\commands\build-fix.md`

- [ ] **Step 1: Create the file**

```markdown
Read the most recent build output or lint errors. For each error:
1. Identify the root cause (not the symptom)
2. Trace the error to the specific file and line
3. Apply the minimal fix
4. Verify the build passes after the fix

Focus on compilation/type/lint errors. For logic bugs, use /superpowers:systematic-debugging instead.

Do NOT weaken lint/type configs — fix the code.
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add build-fix slash command"
```

---

## Task 14: Command — context-audit.md

**Files:**
- Create: `C:\Users\Tao\.claude\commands\context-audit.md`

- [ ] **Step 1: Create the file**

```markdown
Audit the current Claude Code context budget:

1. List all loaded components:
   - Rules (from ~/.claude/rules/)
   - Hooks (from ~/.claude/hooks/)
   - Plugins (from settings.json enabledPlugins)
   - MCP servers (from settings.json)
   - Agents (from ~/.claude/agents/)

2. For each component, estimate token cost (chars / 4 as rough estimate)

3. Classify usage frequency:
   - Always needed (loaded every session)
   - Sometimes needed (project-specific)
   - Rarely needed (occasional use)

4. Output a prioritized list of savings recommendations, ordered by:
   - Token savings (highest first)
   - Impact on daily workflow (lowest disruption first)

5. Do NOT recommend removing components that are always needed

Format as a markdown table with columns: Component | Est. Tokens | Frequency | Recommendation
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add context-audit slash command"
```

---

## Task 15: Command — commit-push-pr.md

**Files:**
- Create: `C:\Users\Tao\.claude\commands\commit-push-pr.md`

- [ ] **Step 1: Create the file**

```markdown
Execute the full commit → push → PR workflow:

1. Run `git status` and `git diff` to see all changes
2. Stage relevant files (avoid .env, secrets, build artifacts)
3. Write a conventional commit message following git-workflow.md rules
4. Commit with the message
5. Push to remote (create branch if needed)
6. If on a feature branch, create a PR with:
   - Title: summary of changes (≤70 chars)
   - Body: what changed and why + test plan
   - Use `gh pr create`

Follow the git-workflow.md conventions for commit format and branch naming.

Before destructive operations (force push, reset), ask for confirmation.
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add commit-push-pr slash command"
```

---

## Task 16: Command — harness-check.md

**Files:**
- Create: `C:\Users\Tao\.claude\commands\harness-check.md`

- [ ] **Step 1: Create the file**

```markdown
Run a health check on the current Claude Code harness configuration:

1. **Rules check**: For each .md file in ~/.claude/rules/:
   - Does it exist?
   - Is it under 200 lines?
   - Does it have a clear purpose?

2. **Hooks check**: For each hook in hooks.json and settings.json:
   - Does the script file exist?
   - Does it parse without syntax errors? (node --check)
   - Is the matcher valid?

3. **Agents/Commands check**: For each file in ~/.claude/agents/ and ~/.claude/commands/:
   - Does it have frontmatter (name, description)?
   - Is the description concise?

4. **Token budget**: Estimate total resident token cost

5. **Output**: A punch list of issues, sorted by severity:
   - Broken hooks (will crash)
   - Missing files (referenced but not found)
   - Oversized rules (over 200 lines)
   - Redundant components (overlap with plugins)

Format each issue as: [SEVERITY] file_path — description
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add harness-check slash command"
```

---

## Task 17: Agent — build-error-resolver.md

**Files:**
- Create: `C:\Users\Tao\.claude\agents\build-error-resolver.md`

- [ ] **Step 1: Create the file**

```markdown
---
name: build-error-resolver
description: Resolves build/compilation/type errors by reading error output, tracing root cause, and applying targeted fixes.
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
---

You are a build error specialist. Your job is to make code compile and pass type checks.

**Process:**
1. Read the build error output provided in the task
2. For each error, identify: file, line, error type, root cause
3. Read the relevant source file(s)
4. Apply the minimal fix that resolves the error
5. Run the build again to verify
6. Repeat until build passes

**Rules:**
- NEVER weaken type checking or lint rules — fix the code
- NEVER add `@ts-ignore`, `type: ignore`, `// eslint-disable` — fix the code
- If an error is caused by a missing dependency, install it rather than working around it
- If multiple errors share a root cause, fix the cause once
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add build-error-resolver agent"
```

---

## Task 18: Agent — security-reviewer.md

**Files:**
- Create: `C:\Users\Tao\.claude\agents\security-reviewer.md`

- [ ] **Step 1: Create the file**

```markdown
---
name: security-reviewer
description: Scans code for OWASP Top 10 vulnerabilities including injection, XSS, auth issues, and secrets.
tools:
  - Read
  - Glob
  - Grep
  - Bash
---

You are a security reviewer focused on OWASP Top 10 vulnerabilities.

**Check for:**
- SQL injection, NoSQL injection, command injection
- XSS (reflected, stored, DOM-based)
- Authentication and authorization bypass
- Sensitive data exposure (secrets in code, logging PII)
- Security misconfiguration (CORS, CSP, headers)
- Vulnerable dependencies (check package.json, requirements.txt)

**Output format for each finding:**
- **Severity**: Critical / High / Medium / Low
- **Category**: OWASP category
- **File**: path:line
- **Issue**: what's wrong
- **Impact**: what could happen
- **Fix**: specific code change to resolve

No finding without evidence. No theoretical risks without a concrete attack vector.
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add security-reviewer agent"
```

---

## Task 19: Agent — test-runner.md

**Files:**
- Create: `C:\Users\Tao\.claude\agents\test-runner.md`

- [ ] **Step 1: Create the file**

```markdown
---
name: test-runner
description: Runs test suites, analyzes failures, and identifies patterns in test output.
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Edit
---

You are a test execution and analysis specialist.

**Process:**
1. Detect the test framework (pytest, vitest, jest, etc.) from project config
2. Run the appropriate test command
3. Analyze the output:
   - Count: total, passed, failed, skipped
   - For each failure: file, test name, error message, root cause
   - Pattern detection: multiple failures with same root cause
4. Report results grouped by root cause

**Rules:**
- Run tests as-is first — do not modify tests before the first run
- If a test fails due to environment issues (missing deps, port conflicts), report it clearly
- Never delete or skip failing tests — report them
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add test-runner agent"
```

---

## Task 20: Agent — docs-generator.md

**Files:**
- Create: `C:\Users\Tao\.claude\agents\docs-generator.md`

- [ ] **Step 1: Create the file**

```markdown
---
name: docs-generator
description: Generates API documentation, README sections, and code comments appropriate to the context.
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
---

You are a documentation specialist.

**Process:**
1. Analyze the code to document: functions, classes, APIs, configuration
2. Determine the appropriate documentation level:
   - Public APIs: full docstrings with params, returns, examples
   - Internal utilities: brief docstrings
   - README: user-facing, focus on "how to use" not "how it works"
3. Generate documentation in the project's existing style
4. Do NOT over-document — if a function name is self-explanatory, skip the docstring

**Rules:**
- Follow existing documentation patterns in the codebase
- Use the project's language for comments (match existing style)
- Never add documentation to trivial getters/setters
- Prefer code examples over prose for API docs
```

- [ ] **Step 2: Commit**

```bash
cd D:/Code/ClaudeCode/harnesses
git add -A
git commit -m "feat: add docs-generator agent"
```

---

## Task 21: Integration test — verify all hooks work together

**Files:** None (testing only)

- [ ] **Step 1: Verify all hook scripts parse without errors**

Run: `for f in C:/Users/Tao/.claude/hooks/*.js; do echo -n "$f: "; node --check "$f" && echo "OK" || echo "FAIL"; done`

Expected: All files print `OK`

- [ ] **Step 2: Verify all rules exist**

Run: `for f in C:/Users/Tao/.claude/rules/common/collaboration.md C:/Users/Tao/.claude/rules/common/file-organization.md C:/Users/Tao/.claude/rules/common/code-review.md C:/Users/Tao/.claude/rules/harness-quality.md; do echo -n "$f: "; [ -f "$f" ] && echo "OK" || echo "FAIL"; done`

Expected: All files print `OK`

- [ ] **Step 3: Verify all commands and agents exist**

Run: `for f in C:/Users/Tao/.claude/commands/*.md C:/Users/Tao/.claude/agents/*.md; do echo -n "$f: "; [ -f "$f" ] && echo "OK" || echo "FAIL"; done`

Expected: All files print `OK`

- [ ] **Step 4: Run harness-check command manually**

Run: `/harness-check` in a new Claude Code session to validate the full setup

---

## Self-Review

### Spec Coverage Check
- [x] 1.1 collaboration.md → Task 1
- [x] 1.2 file-organization.md → Task 2
- [x] 1.3 code-review.md → Task 3
- [x] 1.4 harness-quality.md → Task 4
- [x] 2.1 config-protection.js → Task 5
- [x] 2.1 change-safety.js → Task 6
- [x] 2.1 suggest-compact.js → Task 7
- [x] 2.1 batch-format.js → Task 8 (with companion tracker Task 9)
- [x] 2.2 action-guard.js modification → Task 10
- [x] 2.2 session-learner.js modification → Task 11
- [x] 2.3 hooks.json update → Task 12
- [x] 3.1 build-fix.md → Task 13
- [x] 3.2 context-audit.md → Task 14
- [x] 3.3 commit-push-pr.md → Task 15
- [x] 3.4 harness-check.md → Task 16
- [x] 4.1 build-error-resolver.md → Task 17
- [x] 4.2 security-reviewer.md → Task 18
- [x] 4.3 test-runner.md → Task 19
- [x] 4.4 docs-generator.md → Task 20
- [x] Integration test → Task 21

### Placeholder Scan
- No TBD, TODO, or "implement later" found
- No "add appropriate error handling" without specifics
- All code blocks contain complete implementations

### Type Consistency
- All hook input parsing uses consistent `toolInput.tool_name` / `toolInput.tool_input` pattern
- All file paths use forward slashes for consistency
- Tracker file path is consistent between track-written-files.js and batch-format.js (`os.tmpdir() + '/claude-written-files.json'`)
