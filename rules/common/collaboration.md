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

## CLAUDE.md Generation Rules

When generating or updating any project's CLAUDE.md file (via `/init`, `/plan-project`, or manual), always include the Collaboration Principles section above. If the file already exists and lacks it, append it.
