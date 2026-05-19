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
