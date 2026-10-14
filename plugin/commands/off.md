---
description: 关闭 CTF 场景注入，恢复普通会话
allowed-tools: Bash(node:*)
---

关闭 CTF 场景注入。执行下面的命令把插件状态置为关闭：

```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/ctl.js" off
```

关闭成功后告知用户：
1. 从下一轮起不再注入任何场景上下文；
2. 已注入的旧上下文是会话记录的一部分，无法中途擦除——想要完全干净的普通会话，执行 /clear（关闭状态下 SessionStart hook 不会重注入）。
