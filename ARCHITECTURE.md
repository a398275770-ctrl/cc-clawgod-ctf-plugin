# 架构：cc-clawgod-ctf-plugin

## 产品形态

Claude Code 插件（官方 CLI 与 clawgod 封装通用——已验证两者共用同一插件加载器与 `~/.claude` 目录）。

## 三层注入架构

```
┌─────────────────────────────────────────────────────────┐
│ 第①层 常驻场景层                                          │
│ SessionStart hook (startup|resume|clear|compact)         │
│ 内容：内核十条 + 角色判定 + Skill 索引 (+ 首次引导一次性)     │
│ 体积：~3.4 KB ＜ 10,000 字符硬上限                          │
│ 特性：clear/compact 后自动重注入 → 纪律永远在场               │
├─────────────────────────────────────────────────────────┤
│ 第②层 每轮路由层                                          │
│ UserPromptSubmit hook                                    │
│ 词表匹配用户输入 → 红/蓝/裁判/赛道 → 当轮注入场景要点         │
│ 未命中保持安静（第①层判定表在场，模型自行路由）                │
│ 场景切换时注入「已从 X 切到 Y」防串味                        │
├─────────────────────────────────────────────────────────┤
│ 第③层 深度参考层                                          │
│ 3 × model-invoked skill（ctf-kernel / ctf-red-team /      │
│ ctf-blue-team）                                          │
│ 模块全文（内核 33KB / 红队 11KB / 蓝队 7KB）按需加载，        │
│ description 常驻上下文，body 调用后跨轮保持                  │
└─────────────────────────────────────────────────────────┘
```

**兜底关系**：② miss → ① 判定表指导模型 → 模型拉 ③。用户手动兜底：`/ctf:red|blue` 强制场景。

## 数据流

```
用户输入 ──→ UserPromptSubmit hook ──→ router.route(prompt)
             │                          ├─ 命中 → additionalContext（当轮）
             │                          └─ miss → 无输出
             └── 每次会话开始/clear/compact
                  └─→ SessionStart hook ──→ resident-layer.md (+首启引导)（常驻）
```

## 状态管理

- 状态文件：`$CLAUDE_PLUGIN_DATA/plugin-state.json`（跨插件更新持久）
- 字段：`enabled`（软开关）、`forcedScene`（红/蓝强制）、`lastScene`（路由切换检测）
- 首启标记：`$CLAUDE_PLUGIN_DATA/.first-run-done`

## 版本声明点

单一来源：`plugin/.claude-plugin/plugin.json` 的 `version`。`scripts/bump-version.js` 负责同步所有引用点（README 徽章等），禁止手工散改。

## 依赖

零运行时依赖。仅 Node.js ≥18 内置模块（`fs`/`path`/`node:test`）。
