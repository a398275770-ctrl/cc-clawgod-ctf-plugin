---
description: 开启 CTF 场景注入
allowed-tools: Bash(node:*)
---

开启 CTF 攻防场景注入。执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/ctl.js" on
```

开启成功后告知用户：
1. 场景注入已开启——新会话或 /clear 后常驻层生效，本轮起路由层生效；
2. 若当前会话是 /ctf:off 后想彻底干净地重来，建议 /clear 一次（清掉 off 前注入的旧上下文）。
