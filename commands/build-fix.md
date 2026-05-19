# /build-fix

Run appropriate build command and fix any errors.

## Steps

1. Detect project type from files present:
   - `package.json` → `npm run build` or `npx tsc --noEmit`
   - `pyproject.toml` / `setup.py` → run relevant Python checks
   - `Cargo.toml` → `cargo build`
   - `go.mod` → `go build ./...`
   - No build system detected → run lint/type checks only
2. Execute the build command
3. If errors found, analyze root cause and fix
4. Re-run build to confirm fix
5. Report results concisely

## Output Format

- Show build command used
- List errors found (if any) with root cause
- List fixes applied
- Final build status
