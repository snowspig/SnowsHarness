# /commit-push-pr

Smart commit with auto-push and optional PR creation.

## Steps

1. Run `git status` to see changes
2. Run `git diff --stat` for a summary
3. Analyze changes and draft commit message following project conventions:
   - Format: `<type>: <subject>` (max 72 chars)
   - Types: feat, fix, refactor, perf, docs, test, chore, style
   - Imperative mood, no trailing period
4. Show staged/unstaged status and ask user to confirm:
   - Which files to stage (suggest relevant ones, exclude noise)
   - Whether to push after commit
   - Whether to create a PR (if on a feature branch)
5. Stage selected files and commit
6. If push requested, push to remote
7. If PR requested, create with `gh pr create`:
   - Title from commit message
   - Body summarizing all changes
   - Include test plan

## Safety

- NEVER push to main/master without explicit confirmation
- NEVER force push
- NEVER commit secrets or credentials
- Always check `git status` before staging
