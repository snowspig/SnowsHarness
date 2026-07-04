# /commit-push-pr

智能提交 + 自动推送 + 可选 PR 创建。

## 步骤

1. `git status` 查看变更
2. `git diff --stat` 获取摘要
3. 分析变更并按项目约定起草 commit message：
   - 格式 `<type>: <subject>`（≤72 字符）
   - type: feat, fix, refactor, perf, docs, test, chore, style
   - 祈使语气，无尾句号
4. 展示暂存/未暂存状态，请用户确认：
   - 暂存哪些文件（建议相关文件，排除噪声）
   - 是否提交后推送
   - 是否创建 PR（若在 feature 分支）
5. 暂存选定文件并提交
6. 若需推送，推送到远端
7. 若需 PR，用 `gh pr create` 创建：
   - 标题取自 commit message
   - body 汇总所有变更
   - 附测试计划

## 安全

- **禁止**未经明确确认推送到 main/master
- **禁止** force push
- **禁止**提交密钥或凭据
- 暂存前必查 `git status`
