检查开发环境与依赖服务的健康状态。

$ARGUMENTS

## 步骤

运行以下检查并报告状态：

### 1. ZCode Provider 连通性
读取 `~/.zcode/v2/config.json` 中启用的 provider，对每个 `enabled: true` 的 provider 测试其 baseURL 连通性：
```bash
curl -s -o /dev/null -w "%{http_code}" <baseURL>
```
报告每个 provider 的状态与模型。

### 2. SnowsRouter（若配置）
检查 SnowsRouter 端点（通常 OpenWrt `192.168.8.1:8856`）：
```bash
curl -s -o /dev/null -w "%{http_code}" http://192.168.8.1:8856/
```

### 3. MCP 服务
检查 snows-index MCP 是否连接：
- 调用 `code_search` 做一个空查询，确认返回正常

### 4. 代码索引
检查当前项目的 `.snows-index/index.db` 是否存在、符号数、文件数、最后更新时间。

### 5. 系统资源
- 磁盘: `df -h`
- 内存: `free -h`（Linux）或对应 Windows 命令
- GPU（若有）: `nvidia-smi`

### 输出格式
```
## 环境健康检查

| 服务            | 状态 | 详情            |
|-----------------|------|-----------------|
| GLM Provider    | OK   | open.bigmodel.cn|
| SnowsRouter     | OK   | 200             |
| MCP snows-index | OK   | 4 工具          |
| 代码索引        | OK   | 85 符号/236文件 |
| 磁盘            | OK   | 45% used        |

总体: 健康 / 降级 / 宕机
问题: <列出任何问题>
```
