# /build-fix

运行适当的构建命令并修复任何错误。

## 步骤

1. 按存在文件检测项目类型：
   - `package.json` → `npm run build` 或 `npx tsc --noEmit`
   - `pyproject.toml` / `setup.py` → 运行相关 Python 检查
   - `Cargo.toml` → `cargo build`
   - `go.mod` → `go build ./...`
   - 无构建系统 → 仅跑 lint/type 检查
2. 执行构建命令
3. 出错则分析根因并修复
4. 重新构建确认修复
5. 简洁报告结果

## 输出格式

- 使用的构建命令
- 发现的错误（含根因）
- 应用的修复
- 最终构建状态
