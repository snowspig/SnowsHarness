# Git Workflow

## 提交格式

`<type>: <subject>`

Types: feat, fix, refactor, perf, docs, test, chore, style

- Subject ≤72 字符
- 祈使语气（"add feature" 非 "added"）
- Subject 不用句号
- Body 解释 WHY

## 分支策略

- `main/master`: 生产
- `feature/<name>`: 新功能
- `fix/<name>`: bugfix
- `refactor/<name>`: 重构
- 分支短生命周期（<3 天）

## PR 规范

- Title ≤70 字符概括
- Description: 变更+原因+测试计划
- Review 后合并
- 小提交 squash，有意义的保留

## 常用操作

```bash
# 从 main 创建 feature 分支
git checkout main && git pull && git checkout -b feature/my-feature

# 暂存特定文件
git add path/to/file1.py path/to/file2.py

# 交互 rebase（清理提交）
git rebase -i main  # 永不 rebase 共享分支

# 紧凑日志
git log --oneline --graph -20
```

## 安全规则

- ❌ 绝不 force push 到 main/master
- ❌ 绝不提交 secrets/凭证
- ✅ commit 前 `git status`
- ✅ 优先用 `.gitignore`
- ❌ 绝不提交 `__pycache__/`, `node_modules/`, `.env`, `*.pyc`
