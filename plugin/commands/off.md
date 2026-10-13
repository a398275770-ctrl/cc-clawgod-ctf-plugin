---
description: 关闭 CTF 场景注入，恢复普通会话
allowed-tools: Bash(node:*)
---

关闭 CTF 场景注入。执行下面的命令把插件状态置为关闭：

```bash
node -e "const fs=require('fs'),path=require('path');const dir=process.env.CLAUDE_PLUGIN_DATA||path.join(process.env.CLAUDE_PLUGIN_ROOT||'.','.state');fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'plugin-state.json');let s={};try{s=JSON.parse(fs.readFileSync(f,'utf8'))}catch{};s.enabled=false;s.forcedScene=null;fs.writeFileSync(f,JSON.stringify(s,null,2));console.log('disabled')"
```

关闭成功后告知用户：
1. 从下一轮起不再注入任何场景上下文；
2. 已注入的旧上下文是会话记录的一部分，无法中途擦除——想要完全干净的普通会话，执行 /clear（关闭状态下 SessionStart hook 不会重注入）。
