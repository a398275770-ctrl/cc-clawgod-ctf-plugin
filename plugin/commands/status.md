---
description: 查看当前场景与开关状态
allowed-tools: Bash(node:*)
---

查看 CTF 插件当前状态。执行：

```bash
node -e "const fs=require('fs'),path=require('path');const dir=process.env.CLAUDE_PLUGIN_DATA||path.join(process.env.CLAUDE_PLUGIN_ROOT||'.','.state');const f=path.join(dir,'plugin-state.json');let s={enabled:true,forcedScene:null,lastScene:null};try{s={...s,...JSON.parse(fs.readFileSync(f,'utf8'))}}catch{};console.log(JSON.stringify(s))"
```

用读到的状态向用户报告（中文，简洁）：
- 注入开关：开启 / 关闭
- 强制场景：无（自动路由）/ 红队 / 蓝队
- 最近命中场景：无记录 / red / blue / referee / track

并附一句切换提示：/ctf:on、/ctf:off、/ctf:red、/ctf:blue 可随时调整。
