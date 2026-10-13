---
description: 开启 CTF 攻防场景注入
allowed-tools: Bash(node:*)
---

开启 CTF 攻防场景注入。执行下面的命令把插件状态置为开启：

```bash
node -e "const fs=require('fs'),path=require('path'),os=require('os');const dir=process.env.CLAUDE_PLUGIN_DATA||path.join(process.env.CLAUDE_PLUGIN_ROOT||'.','.state');fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'plugin-state.json');let s={};try{s=JSON.parse(fs.readFileSync(f,'utf8'))}catch{};s.enabled=true;fs.writeFileSync(f,JSON.stringify(s,null,2));console.log('enabled')"
```

开启成功后告知用户：
1. 场景注入已开启——新会话或 /clear 后常驻层生效，本轮起路由层生效；
2. 若当前会话是 /ctf:off 后想彻底干净地重来，建议 /clear 一次（清掉 off 前注入的旧上下文）。
