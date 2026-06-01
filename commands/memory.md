Memory Palace management — inspect, search, and save memories.

$ARGUMENTS

## Sub-commands

### `/memory` (no args) — Status

Show current Memory Palace status: wings, entry counts, active context.

1. Find the project's memory directory:
   - Check `~/.claude/projects/<project-slug>/memory/` for wings/ structure
   - The project slug is the cwd with `/` replaced by `-`
2. Read `MEMORY.md` and display:
   - Active Context entries (★ items)
   - Wings table with entry counts
3. If no memory directory exists, report "Memory Palace not initialized"

### `/memory search <query>` — Search Memories

Search across all wings for relevant memories.

1. Scan all `wings/*/facts.md`, `wings/*/events.md`, `wings/*/preferences.md`
2. Match query against headings, ★ items, and content
3. Return matching entries with wing name and file location
4. Limit to top 10 results

### `/memory wing <name>` — Inspect Wing

Load and display a specific wing's content (L2+L3).

1. Read `wings/<name>/README.md` for overview
2. Read `wings/<name>/facts.md` for all facts
3. Read `wings/<name>/events.md` for recent events
4. Read `wings/<name>/preferences.md` for preferences
5. Display formatted output

### `/memory save` — Manual Checkpoint

Save important context from the current conversation to memory.

1. Identify what's worth saving using the Quality Gate:
   - Will this be useful in a future session?
   - Is this non-obvious (not in code, git, or CLAUDE.md)?
   - Did the user explicitly request or confirm this?
2. Determine the wing and type (fact/event/preference)
3. Write to the appropriate file with proper format:
   - Facts: `## Title` + date/status + content + why + how to apply
   - Events: `## YYYY-MM-DD` + bullet points
   - Preferences: `## Topic` + bullet points
4. Update MEMORY.md if critical (★)
5. Update wing README.md if new entries were added
6. Log the change in `_meta/changelog.md`

### `/memory init` — Initialize Palace

Create the full Memory Palace structure for the current project.

1. Create directory: `~/.claude/projects/<project-slug>/memory/`
2. Create subdirectories: `wings/`, `_meta/`
3. Create `MEMORY.md` with template
4. Create `identity.md` with template
5. Create `wings/_template.md`
6. Create `_meta/changelog.md` with initialization entry

## Quality Gate

Before saving any memory, verify:

- ✅ Useful in future sessions
- ✅ Non-obvious (not in code, git history, or CLAUDE.md)
- ✅ User explicitly requested or confirmed
- ❌ Only matters for this conversation → SKIP
- ❌ Already documented elsewhere → SKIP
