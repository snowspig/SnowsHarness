Analyze the current project and generate/recommend a CLAUDE.md configuration and development setup.

$ARGUMENTS

## Instructions

1. **Detect project type** by scanning the codebase:
   - Python: `pyproject.toml`, `setup.py`, `requirements.txt`, `*.py`
   - Frontend: `package.json`, `tsconfig.json`, `*.tsx`, `*.vue`
   - Full-stack: both Python and frontend indicators
   - Other: Go, Rust, Java indicators

2. **Analyze tech stack**:
   - Framework (Django, FastAPI, Next.js, React, etc.)
   - Database (PostgreSQL, SQLite, MongoDB, etc.)
   - Testing framework (pytest, vitest, jest, etc.)
   - Build tools (vite, webpack, etc.)
   - CI/CD (GitHub Actions, etc.)

3. **Generate project CLAUDE.md** with:
   - Project overview and tech stack
   - Common commands (test, lint, build, run)
   - Project structure
   - Key conventions
   - Environment setup

4. **Include collaboration principles** — always append a first-principles section to generated CLAUDE.md files:

   ```markdown
   ## Collaboration Principles

   从原始需求和问题本质出发，不从惯例和模板出发：
   - 不假设用户清楚自己想要什么 — 动机或目标不清晰时，停下来讨论
   - 目标清晰但路径不是最短的 — 直接告诉用户并建议更好的办法
   - 遇到问题追根本原因，不打补丁
   - 每个决策都要能回答“为什么”
   - 输出说重点，砍掉一切不改变决策的信息
   ```

   可以根据项目类型补充更具体的协作规则，但必须保留以上 5 条作为默认原则。

5. **Recommend Claude Code optimizations**:
   - Which agents would be useful
   - Which hooks to enable
   - Permission suggestions
   - Custom commands

6. **Check if CLAUDE.md already exists**:
   - If yes, suggest updates based on current state
   - If Collaboration Principles section is missing, add it
   - If no, create it with the full template

Output the recommended CLAUDE.md content and any setup commands needed.
