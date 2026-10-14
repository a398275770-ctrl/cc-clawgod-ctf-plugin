---
description: 查看当前场景与开关状态
allowed-tools: Bash(node:*)
---

查看 CTF 插件当前状态。执行：

```bash
node "${CLAUDE_PLUGIN_ROOT}/commands/ctl.js" status
```

把输出原样转达给用户，并附一句切换提示：/ctf:on、/ctf:off、/ctf:red、/ctf:blue 可随时调整。
