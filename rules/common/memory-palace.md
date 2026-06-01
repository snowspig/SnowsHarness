# Memory Palace Protocol

## Overview

Memory is organized as a **Memory Palace** — a layered, typed memory system inspired by
[MemPalace](https://github.com/MemPalace/mempalace). Memories are stored as structured
Markdown files, organized by topic (wings), and loaded progressively to minimize token cost.

## Layered Loading (L0–L3)

| Layer  | File                                         | Budget       | Loaded When                  | Content                            |
| ------ | -------------------------------------------- | ------------ | ---------------------------- | ---------------------------------- |
| **L0** | `identity.md`                                | ~100 tok     | Every session start          | Who you are, global preferences    |
| **L1** | `MEMORY.md`                                  | ~500 tok     | Every session start          | Wing index, active context entries |
| **L2** | `wings/<wing>/README.md`                     | ~200-500 tok | On-demand (`/memory wing X`) | Wing overview, keyword index       |
| **L3** | `wings/<wing>/{facts,events,preferences}.md` | Unlimited    | On-demand (`/memory search`) | Full deep memory                   |

**Wake-up cost:** ~600 tokens (L0 + L1), injected by the `session-start` hook.

## Directory Structure

```
memory/
├── MEMORY.md          # L1 entry point (index of all wings + active context)
├── identity.md        # L0: user identity, global preferences
├── wings/
│   ├── _template.md   # Template for new wings
│   └── <wing-name>/
│       ├── README.md  # L2: overview + keywords for hook matching
│       ├── facts.md   # L3: decisions, config choices, constraints
│       ├── events.md  # L3: milestones, incidents (grouped by date)
│       └── preferences.md  # L3: user habits, opinions, style
└── _meta/
    └── changelog.md   # Auto-logged memory changes
```

## Memory Types

When the user says "remember X" or you detect an important finding:

1. **Determine the wing** — which topic area does this belong to?
2. **Determine the type**:
   - **Fact** (decision, config choice, constraint) → `wings/<wing>/facts.md`
   - **Event** (milestone, incident, deployment) → `wings/<wing>/events.md`
   - **Preference** (opinion, style, habit) → `wings/<wing>/preferences.md`
   - **Identity** (who the user is, global prefs) → `identity.md`
3. **Write with proper format** (see below)
4. **Update MEMORY.md** if the fact is critical (★) or changes active context
5. **Update wing README.md** if new entries were added

## Writing Format

### Facts

```markdown
## Title

- **Date**: YYYY-MM-DD | **Status**: active/critical/superseded
- ★ Critical facts get this prefix — they surface in L1 context
- Content describing the fact
- **Why:** Reason this matters
- **How to apply:** What to do differently because of this
```

### Events

```markdown
## YYYY-MM-DD

- Bullet point describing what happened
- Impact or follow-up needed
```

### Preferences

```markdown
## Topic

- Bullet point describing the preference
- Context for when it applies
```

## Verbatim Principle

When capturing user statements, store **exact quotes** (verbatim), not summaries.
Summaries lose nuance. Mark verbatim quotes with `>` blockquote syntax.

Example:

```markdown
## Error Handling Preference

- **Date**: 2026-06-01 | **Status**: active
- > "不要给我加 try-catch 包裹，让错误直接暴露"
- **Why:** User prefers explicit error handling over blanket catches
- **How to apply:** Only add try-catch when user requests it
```

## MEMORY.md Format (L1 Index)

```markdown
# Memory Palace

## Active Context

- ★ [Critical Fact Title](wings/wing-name/facts.md#title) — one-line summary
- [Active Item](wings/wing-name/facts.md#title) — one-line summary

## Wings

| Wing      | Entries | Last Updated | Keywords           |
| --------- | ------- | ------------ | ------------------ |
| wing-name | 12      | 2026-06-01   | keyword1, keyword2 |
```

**Size limit:** max 200 lines. Prune oldest Active Context entries if exceeded.

## File Size Limits

| File                       | Max Lines | Overflow Action             |
| -------------------------- | --------- | --------------------------- |
| `MEMORY.md`                | 200       | Prune oldest Active Context |
| `identity.md`              | 50        | Merge duplicates            |
| Each wing `README.md`      | 80        | Archive old entries         |
| Each wing `facts.md`       | 100       | Archive superseded facts    |
| Each wing `events.md`      | 100       | Keep only last 30 days      |
| Each wing `preferences.md` | 50        | Merge duplicates            |

## Creating a New Wing

1. Copy `wings/_template.md` content to `wings/<new-wing>/README.md`
2. Create `facts.md`, `events.md`, `preferences.md` with proper headers
3. Add entry to Wings table in MEMORY.md
4. Fill in README.md Keywords line for session-start hook matching

## Keywords (for Wing Matching)

Each wing's README.md has a `## Keywords` line. The session-start hook matches
these keywords against the project directory path and CLAUDE.md content. Use
specific, unique keywords (e.g., "snowsrouter" not "routing").

## Auto-Save Triggers

Memories are persisted at these points:

- **User says "remember X"** → immediate write
- **Task completes** → write progress and decisions
- **PreCompact** → emergency save before context compression (hook)
- **Session end** → session-learner mines patterns and writes insights
- **/memory save** → manual checkpoint command

## Quality Gate

Not everything should be saved. Before writing:

- ✅ Will this be useful in a future session?
- ✅ Is this non-obvious (not in code, git history, or CLAUDE.md)?
- ✅ Did the user explicitly request or confirm this?
- ❌ Skip if it only matters for this conversation
- ❌ Skip if it's already documented elsewhere

## Related

- `hooks/session-start.js` — L0+L1 injection
- `hooks/session-learner.js` — end-of-session memory mining
- `commands/memory.md` — `/memory` interactive command
- Reference: `references/mempalace/` — MemPalace project that inspired this design
