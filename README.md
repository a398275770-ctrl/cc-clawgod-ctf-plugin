# cc-clawgod-ctf-plugin

把一份 CTF/AWD 攻防系统提示词（CT Attack-Defense Prompt v3.0）通过 hook 确定性注入 Claude Code 的插件。适用于官方 Claude Code 与 clawgod 封装（同一套插件机制，已验证）。

## 它解决什么问题

- **你不用记提示词**：装上就自动生效，会话开始注入执行内核，`/clear`、上下文压缩后自动补回。
- **你不用判断红队还是蓝队**：插件读你的自然输入自动路由——「帮我 pwn 这题」进红队，「服务器被种马了」进蓝队，说错了也没关系，有模型侧兜底和 `/ctf:red` / `/ctf:blue` 手动开关。
- **上下文不爆炸**：56 KB 提示词分三层——常驻层 3.4 KB、每轮路由按需 1 KB 内、完整红蓝战术块做成 skill 按需加载。

## 安装（marketplace 形式）

```bash
# 本地 marketplace（开发期）
claude plugin marketplace add /path/to/cc-clawgod-ctf-plugin
claude plugin install ctf@cc-clawgod-ctf-plugin

# GitHub marketplace（发布后）
claude plugin marketplace add <owner>/cc-clawgod-ctf-plugin
claude plugin install ctf@cc-clawgod-ctf-plugin
```

clawgod 用户同样在 clawgod 会话里执行上述命令即可（共享 `~/.claude` 插件缓存）。

## 使用

插件**默认关闭**（不主动改变你的模型行为）。装好后第一次会话会看到一次性开启提示，之后：

| 命令 | 作用 |
|---|---|
| `/ctf:on` | 开启场景注入 |
| `/ctf:off` | 关闭注入（配 `/clear` 回到纯净会话） |
| `/ctf:red` | 强制红队模式 |
| `/ctf:blue` | 强制蓝队模式 |
| `/ctf:status` | 查看开关与场景状态 |

所有命令都有补全：输入 `/ctf:` 即可看到列表与说明。

## 开发

```bash
npm test    # 结构测试 + lint + hook 行为测试（25 项）
npm run lint
```

- 架构与数据流：`ARCHITECTURE.md`
- 硬性约束与工作方式：`AGENTS.md`
- 需求与决策记录：`docs/requirements.md`

## 版本

`v0.1.0`（Day 0 MVP）。版本 bump 一律走 `npm run bump <x.y.z>`。
