/**
 * Output Size Warning Hook
 *
 * PostToolUse hook that warns when tool outputs are excessively large.
 * Helps prevent context window waste and guides users toward targeted reads/searches.
 *
 * Trigger: PostToolUse Read/Grep/Bash/Glob
 * Action: Warn if output exceeds threshold
 */

const fs = require("fs");

const WARN_THRESHOLD_CHARS = 10000; // ~10KB
const WARN_THRESHOLD_LINES = 200;

/**
 * Count lines in a string
 */
function countLines(str) {
  return str.split("\n").length;
}

/**
 * Suggest narrower alternatives based on tool type
 */
function getSuggestion(toolName, input) {
  switch (toolName) {
    case "Read":
      return "Use offset/limit to read specific line ranges instead of the whole file.";
    case "Grep":
      return "Narrow the search with a more specific pattern, glob, or lower head_limit.";
    case "Bash":
      return "Pipe through head/tail or use more targeted flags to reduce output.";
    case "Glob":
      return "Use a more specific pattern or search in a subdirectory.";
    default:
      return "Consider narrowing the query to reduce context usage.";
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

  // Only process relevant tools
  const relevantTools = ["Read", "Grep", "Bash", "Glob"];
  if (!relevantTools.includes(toolInput.tool_name)) return;

  // Extract output from tool result
  const output = toolInput.tool_output || "";
  if (!output) return;

  const charCount = output.length;
  const lineCount = countLines(output);

  if (charCount > WARN_THRESHOLD_CHARS || lineCount > WARN_THRESHOLD_LINES) {
    const suggestion = getSuggestion(toolInput.tool_name, toolInput.tool_input);

    console.error("\n=== OUTPUT SIZE WARNING ===");
    console.error(`Tool: ${toolInput.tool_name}`);
    console.error(`Output size: ${charCount.toLocaleString()} chars, ${lineCount.toLocaleString()} lines`);
    console.error(`This may waste context window space.`);
    console.error(`Suggestion: ${suggestion}`);
    console.error("===========================\n");
  }
}

main();