/**
 * Session Learner Hook (SessionEnd)
 * Reads session logs, detects debug/fix patterns, applies quality gate,
 * writes high-value insights to Memory Palace wings.
 *
 * Quality gate (from OMC learner concept):
 * - Not Googleable in 5 min
 * - Specific to this codebase
 * - Required real debugging effort
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_PATTERN_LENGTH = 200;
const MAX_FACTS_LINES = 100;
const SESSION_LOG = path.join(os.homedir(), '.claude', 'session-log.jsonl');
const TELEMETRY_LOG = path.join(os.homedir(), '.claude', 'session-telemetry.jsonl');
// Replace hardcoded project path with dynamic detection
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const projectSlug = projectDir.replace(/[\\/]/g, "-").replace(/^-+/, "").replace(/\/$/, "");
const MEMORY_DIR = path.join(os.homedir(), '.claude', 'projects', projectSlug, 'memory');
const LEARNER_LOG = path.join(os.homedir(), '.claude', '.learner-log.jsonl');

function readLastLines(filePath, maxLines = 500) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
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
    } catch { /* skip */ }
  }
  return entries;
}

function detectDebugPatterns(entries) {
  const patterns = [];

  // Track file access frequency
  const fileReads = {};
  const fileEdits = {};
  let bashTestRuns = [];
  let lastEditFile = null;

  for (const entry of entries) {
    const tool = entry.tool_name || '';
    const input = entry.tool_input || {};
    const output = entry.tool_output || '';

    // Count file reads
    if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') {
      const fp = input.file_path || input.path || '';
      if (fp) {
        fileReads[fp] = (fileReads[fp] || 0) + 1;
      }
    }

    // Track edits
    if (tool === 'Edit' || tool === 'Write') {
      const fp = input.file_path || input.path || '';
      if (fp) {
        fileEdits[fp] = (fileEdits[fp] || 0) + 1;
        lastEditFile = fp;
      }
    }

    // Track test runs
    if (tool === 'Bash') {
      const cmd = input.command || '';
      if (/pytest|jest|vitest|mocha|cargo test|go test|ruff check|eslint|npm test/i.test(cmd)) {
        bashTestRuns.push({ cmd, output: (output || '').slice(0, 200) });
      }
    }
  }

  // Pattern 1: Heavily read file = likely debugging target
  for (const [fp, count] of Object.entries(fileReads)) {
    if (count >= 3) {
      patterns.push({
        type: 'debug_target',
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
      type: 'bug_fix',
      testCommand: testCmd,
      editedFiles,
      effort: bashTestRuns.length + editedFiles.length * 2,
    });
  }

  // Pattern 3: Multiple edits to same file = iterative fix
  for (const [fp, count] of Object.entries(fileEdits)) {
    if (count >= 2) {
      patterns.push({
        type: 'iterative_fix',
        file: fp,
        editCount: count,
        effort: count * 3,
      });
    }
  }

  return patterns;
}

function applyQualityGate(pattern) {
  // Skip low-effort patterns
  if (pattern.effort < 4) return null;

  // Skip generic paths (node_modules, site-packages, etc.)
  const fp = pattern.file || '';
  const genericPaths = ['node_modules', 'site-packages', '.git', '__pycache__'];
  if (genericPaths.some(p => fp.includes(p))) return null;

  // Require codebase-specific file
  if (fp && !fp.includes(os.homedir())) return null;

  return pattern;
}

function formatFact(pattern) {
  const now = new Date().toISOString().slice(0, 10);
  switch (pattern.type) {
    case 'debug_target':
      return {
        title: `Debug hotspot: ${path.basename(pattern.file)}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- File ${pattern.file} was read ${pattern.readCount}x and edited ${pattern.edited}x in one session`,
          `- Likely contains non-obvious behavior that required investigation`,
        ].join('\n'),
        wing: guessWing(pattern.file),
      };
    case 'bug_fix':
      return {
        title: `Bug fix pattern: ${pattern.editedFiles.map(f => path.basename(f)).join(', ')}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- Test: \`${pattern.testCommand}\``,
          `- Fixed by editing: ${pattern.editedFiles.join(', ')}`,
          `- Required ${pattern.effort} total tool interactions to resolve`,
        ].join('\n'),
        wing: guessWing(pattern.editedFiles[0] || ''),
      };
    case 'iterative_fix':
      return {
        title: `Iterative fix: ${path.basename(pattern.file)}`,
        content: [
          `- **Date**: ${now} | **Status**: active`,
          `- File ${pattern.file} required ${pattern.editCount} edits in one session`,
          `- Suggests the fix was non-trivial or had side effects`,
        ].join('\n'),
        wing: guessWing(pattern.file),
      };
    default:
      return null;
  }
}

function guessWing(filePath) {
  const fp = filePath.toLowerCase();
  if (fp.includes('snowsrouter') || fp.includes('routing') || fp.includes('ppchat')) return 'snowsrouter';
  if (fp.includes('qlib') || fp.includes('xtquant') || fp.includes('quantbox') || fp.includes('factor')) return 'quant';
  if (fp.includes('.claude') || fp.includes('hook') || fp.includes('memory')) return 'claude-code';
  if (fp.includes('docker') || fp.includes('deploy') || fp.includes('nginx')) return 'devops';
  return 'claude-code';
}

function writeFactToWing(fact) {
  if (!fact) return;

  const wingDir = path.join(MEMORY_DIR, 'wings', fact.wing);
  const factsFile = path.join(wingDir, 'facts.md');

  // Ensure directory exists
  if (!fs.existsSync(wingDir)) {
    fs.mkdirSync(wingDir, { recursive: true });
  }

  // Read existing facts
  let existing = '';
  if (fs.existsSync(factsFile)) {
    existing = fs.readFileSync(factsFile, 'utf-8');
  }

  // Check line limit
  const existingLines = existing.split('\n').length;
  if (existingLines >= MAX_FACTS_LINES) {
    logLearnerAction('skip', `facts.md at ${existingLines} lines (limit ${MAX_FACTS_LINES})`);
    return;
  }

  // Check for duplicate title
  if (existing.includes(fact.title)) {
    logLearnerAction('skip', `duplicate: ${fact.title}`);
    return;
  }

  // Append fact
  const entry = `\n## ${fact.title}\n${fact.content}\n`;
  fs.appendFileSync(factsFile, entry, 'utf-8');
  logLearnerAction('write', `${fact.wing}/facts.md + ${fact.title}`);
}

function logLearnerAction(action, detail) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    detail,
  }) + '\n';
  try {
    fs.appendFileSync(LEARNER_LOG, entry, 'utf-8');
  } catch { /* silent */ }
}

function main() {
  try {
    // Read recent session entries
    const lines = readLastLines(SESSION_LOG, 500);
    if (lines.length === 0) return;

    const entries = parseSessionLog(lines);
    if (entries.length === 0) return;

    // Detect patterns
    const patterns = detectDebugPatterns(entries);

    // Apply quality gate and write
    let written = 0;
    for (const pattern of patterns) {
      const filtered = applyQualityGate(pattern);
      if (!filtered) continue;

      const fact = formatFact(filtered);
      if (!fact) continue;

      writeFactToWing(fact);
      written++;
    }

    if (written > 0) {
      logLearnerAction('summary', `Extracted ${written} pattern(s) from ${entries.length} entries`);
    }
  } catch (e) {
    logLearnerAction('error', e.message);
  }
}

main();
