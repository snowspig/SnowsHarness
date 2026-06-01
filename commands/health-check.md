Check the health of the development environment and all dependent services.

$ARGUMENTS

## Instructions

Run the following checks and report status:

### 1. SnowsRouter (OpenWrt)
```bash
curl -s -o /dev/null -w "%{http_code}" http://192.168.8.1:8856/
```
- Status: OK (200) / NOT RUNNING
- Shared router deployed on OpenWrt, serves all clients

### 2. vLLM (Workstation 192.168.8.227)
```bash
curl -s http://192.168.8.227:8000/v1/models
```
- Status: OK / NOT RUNNING
- Model name and context window

### 3. API Connectivity
Test each configured API endpoint:
- ppchat.vip (Claude + GPT): `curl -s -o /dev/null -w "%{http_code}" https://code.ppchat.vip`
- Zhipu AI (GLM): `curl -s -o /dev/null -w "%{http_code}" https://open.bigmodel.cn`
- MiniMax: `curl -s -o /dev/null -w "%{http_code}" https://api.minimaxi.com`

### 4. System Resources
- GPU: `nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader`
- Disk: `df -h /`
- Memory: `free -h`

### 5. Docker Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Output Format
```
## Environment Health Check

| Service         | Status | Details |
|-----------------|--------|---------|
| SnowsRouter     | OK     | 200     |
| vLLM            | OK     | 200K ctx |
| ppchat.vip      | OK     | 200     |
| Zhipu AI        | OK     | 200     |
| MiniMax         | OK     | 200     |
| GPU             | OK     | 45/96GB |
| Docker          | OK     | 1 running |

Overall: HEALTHY / DEGRADED / DOWN
Issues: <list any problems>
```
