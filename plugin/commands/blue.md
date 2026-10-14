---
description: 强制蓝队模式（防御/加固/应急）
allowed-tools: Bash(node:*)
---

强制蓝队模式。执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/ctl.js" blue
```

设置成功后：
1. 告知用户蓝队模式已强制（自动路由不再改判，直到 /ctf:red 或 /ctf:off 重置）；
2. 读取 skill `ctf-blue-team` 获取完整蓝队纪律，按其执行当前任务。
