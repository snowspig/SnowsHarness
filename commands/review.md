Review recent code changes for bugs, security issues, and code quality.

$ARGUMENTS

## Instructions

1. Check git for recent changes:
   - If in a git repo: `git diff HEAD~1` or `git diff --staged`
   - If not in git repo: scan recently modified files (last 24h)

2. Run the code-reviewer agent on the changed files:
   - Check correctness, security, performance, and code quality
   - Reference specific files and line numbers

3. Also check for:
   - Missing error handling
   - Type annotation gaps
   - Test coverage for changed code

4. Output a structured review report:
   - Summary of changes
   - Issues found (severity: CRITICAL / WARNING / INFO)
   - Positive observations
   - Recommended actions

Be thorough but practical. Focus on real issues, not style nitpicks.
