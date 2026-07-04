"use strict";
/**
 * ZCode hook output helper.
 *
 * ZCode hook contract (differs from Claude Code):
 * - stdout is parsed as a STRICT JSON object; extra keys fail validation and the
 *   hook run is discarded. stderr is written to the log ONLY — the model never
 *   sees stderr. So all model-facing messages must go through stdout JSON.
 * - `additionalContext` (string) is injected into the conversation context.
 * - For PreToolUse / PermissionRequest, `hookSpecificOutput.permissionDecision`
 *   can be "allow" | "ask" | "deny" with a reason. This is preferred over
 *   exit code 2 because it carries a human-readable reason.
 * - exit 0 = pass, exit 2 = block (PreToolUse/PermissionRequest only).
 *
 * Usage:
 *   const { notify, deny, allow, ask } = require("./_lib/zcode-output");
 *   notify("warning text the model should see");
 *   deny("reason to block the tool call");
 */

const ALLOWED_KEYS = new Set(["additionalContext", "hookSpecificOutput"]);

function emit(obj) {
  // Strip any key ZCode does not recognise, to avoid schema-validation failure.
  const clean = {};
  for (const k of Object.keys(obj)) {
    if (ALLOWED_KEYS.has(k)) clean[k] = obj[k];
  }
  process.stdout.write(JSON.stringify(clean) + "\n");
}

/** Inject a message into the conversation (model-visible). Pass nothing to
 *  emit an empty (valid) object — useful when a hook just wants to pass. */
function notify(text) {
  if (text === undefined || text === null || text === "") {
    process.stdout.write("{}\n");
    return;
  }
  emit({ additionalContext: String(text) });
}

/** Block a PreToolUse / PermissionRequest call with a reason. */
function deny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: String(reason),
    },
  });
}

/** Explicitly allow a PreToolUse / PermissionRequest call. */
function allow(reason) {
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
    },
  };
  if (reason) out.hookSpecificOutput.permissionDecisionReason = String(reason);
  emit(out);
}

/** Ask the user to decide (non-blocking prompt). */
function ask(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason ? String(reason) : undefined,
    },
  });
}

module.exports = { notify, deny, allow, ask, emit };
