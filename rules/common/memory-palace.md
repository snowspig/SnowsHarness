# Memory Palace Protocol

## Overview
Memory is organized as a **Memory Palace** — structured directory with typed memory files
organized by topic (wings). MEMORY.md is the L0+L1 entry point. Wings hold deep memory.

## Directory Structure
```
memory/
├── MEMORY.md          # L0+L1 entry point (you are reading this)
├── identity.md        # L0: user identity, global preferences
├── wings/
│   ├── _template.md   # Template for new wings
│   ├── <wing-name>/   # Each wing = one topic area
│   │   ├── README.md  # Overview + keywords for hook matching
│   │   ├── facts.md   # Decisions, config choices, constraints
│   │   ├── events.md  # Milestones, incidents (grouped by date)
│   │   └── preferences.md # User habits, opinions, style
└── _meta/
    └── changelog.md   # Auto-logged memory changes
```

## How to Write Memories

When the user says "remember X" or you need to save an important finding:

1. **Determine the wing** — which topic area does this belong to?
2. **Determine the type**:
   - **Fact** (decision, config choice, constraint) → `wings/<wing>/facts.md`
   - **Event** (milestone, incident, deployment) → `wings/<wing>/events.md`
   - **Preference** (opinion, style, habit) → `wings/<wing>/preferences.md`
   - **Identity** (who the user is, global prefs) → `identity.md`
3. **Write with proper format**:
   - Facts: `## Title` heading + `**Date**: YYYY-MM-DD | **Status**: active/critical/superseded` + content
   - Events: `## YYYY-MM-DD` heading + bullet points
   - Preferences: `## Topic` heading + bullet points
4. **Update MEMORY.md** if the fact is critical (★) or changes active context:
   - Add to Active Context section
   - Update Wings table item count and Last Updated date
5. **Mark critical facts** with ★ prefix — these surface in L1 context

## Fact Format Example
```markdown
## API Base URL
- **Date**: 2026-03-28 | **Status**: critical
- ★ ANTHROPIC_API_BASE must NOT include /v1: use `https://code.ppchat.vip`
- LiteLLM appends /v1 automatically — including it causes double-path error
```

## File Size Limits
- MEMORY.md: max 200 lines — prune oldest Active Context entries if exceeded
- Each wing facts.md: max 100 lines — archive superseded facts
- Each wing events.md: max 100 lines — keep only last 30 days in main file
- Each wing preferences.md: max 50 lines — merge duplicates

## Creating a New Wing
1. Copy `wings/_template.md` content to `wings/<new-wing>/README.md`
2. Create `facts.md`, `events.md`, `preferences.md` with proper headers
3. Add entry to Wings table in MEMORY.md
4. Fill in README.md Keywords line for session-start hook matching

## Keywords (for Wing Matching)
Each wing's README.md has a `## Keywords` line. The session-start hook matches
these keywords against the project directory path and CLAUDE.md content. Use
specific, unique keywords (e.g., "nadirclaw" not "routing").
