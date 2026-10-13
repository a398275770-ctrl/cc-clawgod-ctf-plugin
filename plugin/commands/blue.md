---
description: 强制蓝队模式（防御/加固/应急）
allowed-tools: Bash(node:*)
---

强制蓝队模式。执行下面的命令把插件状态置为开启 + 蓝队强制：

```bash
node -e "const fs=require('fs'),path=require('path');const dir=process.env.CLAUDE_PLUGIN_DATA||path.join(process.env.CLAUDE_PLUGIN_ROOT||'.','.state');fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'plugin-state.json');let s={};try{s=JSON.parse(fs.readFileSync(f,'utf8'))}catch{};s.enabled=true;s.forcedScene='蓝队';s.lastScene='blue';fs.writeFileSync(f,JSON.stringify(s,null,2));console.log('blue-forced')"
```

设置成功后：
1. 告知用户蓝队模式已强制（自动路由不再改判，直到 /ctf:red 或 /ctf:status 重置）；
2. 读取 skill `ctf-blue-team` 获取完整蓝队纪律，按其执行当前任务。
