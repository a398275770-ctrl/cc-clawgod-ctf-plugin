---
description: 强制红队模式（进攻/拿 flag）
allowed-tools: Bash(node:*)
---

强制红队模式。执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/ctl.js" red
```

设置成功后：
1. 告知用户红队模式已强制（自动路由不再改判，直到 /ctf:blue 或 /ctf:off 重置）；
2. 读取 skill `ctf-red-team` 获取完整红队纪律，按其执行当前任务。
