# cc-clawgod-ctf-plugin

面向 CTF/AWD/红蓝演练的 Claude Code 插件（`ctf`）：通过 hook 确定性注入攻防场景上下文，自动路由红队/蓝队。

## 目录地图

- 需求与决策：`docs/requirements.md`（技术栈结论 §8、决策记录 §9）
- CI 决定：`docs/CI.md`（非 Tauri，无打包流水线）
- 架构：`ARCHITECTURE.md`
- 核心信念：`docs/design-docs/core-beliefs.md`
- 执行计划：`docs/exec-plans/active/day0-plugin-mvp.md`
- 源提示词（乱码原件/修复稿/修复报告）：`docs/references/`

## 插件结构（plugin/）

```
plugin/
├── .claude-plugin/plugin.json   # manifest（name=ctf，唯一版本声明点）
├── hooks/hooks.json             # SessionStart + UserPromptSubmit
├── hooks/lib/state.js           # 软开关状态（CLAUDE_PLUGIN_DATA）
├── hooks/lib/router.js          # 全赛道路由词表
├── hooks/session-start.js       # 常驻层注入
├── hooks/user-prompt-submit.js  # 每轮路由层注入
├── commands/on|off|red|blue|status.md   # 五命令（原生补全）
├── skills/ctf-kernel|ctf-red-team|ctf-blue-team/  # 深度参考层
└── assets/                      # 注入文本与模块全文（构建产物来源）
```

## 硬性约束（不可违反）

- hook 注入文本单次 ≤10,000 字符（Claude Code 硬上限，超限内容对模型不可见）
- 常驻层（resident-layer.md）控制在 6,500 字符内，给首次引导留余量
- hook 全部 `node` 直调；禁止 bash/ps1 实现（Windows 兼容）
- stdin/stdout 显式 UTF-8；不硬编码路径分隔符
- hook 失败绝不阻塞会话（输出最小 fallback 后 exit 0）
- 状态文件只写 `CLAUDE_PLUGIN_DATA`，禁止写插件安装目录
- 三层架构不可削减：常驻层/路由层/参考层缺一即架构回归
- 修改词表或注入文本必须同步跑 `tests/` 并更新 `docs/requirements.md` 决策记录

## 工作方式

- 提交前运行：`npm test`（或 `node --test tests/`）
- 提交颗粒度：一次提交只做一件事，Conventional Commits 前缀
- 会话末次提交须过全部门禁并注明 `[已测试]`/`[未测试]`
- 版本只改 `plugin/.claude-plugin/plugin.json`，用 `scripts/bump-version.js` 同步引用点
- 交互式决策（技术栈/CI/需求范围）确认后必须落盘到 `docs/`
- 每轮用户提示词追加记录到 `prompt-history.txt`（不入库，见 .gitignore；智能体只追加不读取）
