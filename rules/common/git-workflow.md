# Git Workflow

## Commit Messages
Format: `<type>: <subject>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `perf`: Performance improvement
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, config
- `style`: Formatting (no logic change)

Rules:
- Subject line ≤ 72 characters
- Use imperative mood ("add feature" not "added feature")
- Don't end subject with a period
- Body (if needed): explain WHY, not WHAT

## Branch Strategy
- `main` / `master`: production-ready code
- `feature/<name>`: new features
- `fix/<name>`: bug fixes
- `refactor/<name>`: code restructuring
- Keep branches short-lived (< 3 days)

## Pull Request Guidelines
- Title: summarize the change in ≤ 70 characters
- Description: what changed and why
- Include test plan
- Review before merge
- Squash small commits, keep meaningful ones separate

## Common Operations
```bash
# Create feature branch from main
git checkout main && git pull && git checkout -b feature/my-feature

# Stage specific files
git add path/to/file1.py path/to/file2.py

# Interactive rebase (clean up commits)
git rebase -i main  # NEVER rebase shared branches

# View compact log
git log --oneline --graph -20
```

## Safety Rules
- NEVER force push to main/master
- NEVER push secrets or credentials
- ALWAYS check `git status` before committing
- Use `.gitignore` from the start
- Never commit `__pycache__/`, `node_modules/`, `.env`, `*.pyc`
