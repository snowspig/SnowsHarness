审查最近的代码变更，查找 bug、安全问题和代码质量问题。

$ARGUMENTS

## 步骤

1. 检查 git 近期变更：
   - git 仓库内：`git diff HEAD~1` 或 `git diff --staged`
   - 非 git 仓库：扫描最近 24h 修改的文件

2. 对变更文件运行代码审查（加载 code-review-checklist skill）：
   - 检查正确性、安全、性能、代码质量
   - 引用具体文件和行号
   - 按 Blocker/High/Medium/Nitpick 分级

3. 额外检查：
   - 缺失的错误处理
   - 类型注解缺口
   - 变更代码的测试覆盖

4. 输出结构化审查报告：
   - 变更摘要
   - 发现的问题（含严重度）
   - 积极观察
   - 建议行动

务必彻底但务实，聚焦真实问题，不纠结风格细节。
