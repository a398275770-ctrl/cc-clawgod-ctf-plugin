# 执行计划：Day 0 骨架 + 插件 MVP

- **状态**：active
- **创建日期**：2026年10月14日
- **负责人/驱动**：智能体（用户掌舵：提供需求、验收）

## 目标

按《新建项目 Harness 工程化规则》阶段 A–B 完成 Day 0 交付，并产出可安装、可工作的插件 MVP。

**验收标准**：
- 插件可通过本地 marketplace 安装到 Claude Code（官方与 clawgod）
- 会话开始注入常驻场景层；输入含红/蓝信号词时当轮注入对应场景
- `/ctf:on|off|red|blue|status` 五命令可用，`/ctf:off` 后不再注入
- Windows / Linux / macOS 三平台 hook 行为一致（全 `node` 直调）
- 结构测试 + lint + CI 三件套跑通

## 拆解

- [x] 需求澄清与技术栈确认（§3.2），落盘 `docs/requirements.md`
- [x] 框架判定（§3.3）：其他类型，跳过 Tauri CI 三问，落盘 `docs/CI.md`
- [x] 源提示词乱码修复（GBK→UTF-8 还原），转换清单交用户过目
- [x] 模块拆分：把修复后的提示词切成内核精简版 / 内核全文 / 红队块 / 蓝队块
- [x] 插件骨架：`.claude-plugin/`、`hooks/`、`skills/`、`commands/`
- [x] SessionStart hook（常驻层 + 开关检查 + 首次引导）
- [x] UserPromptSubmit hook（路由层 + 全赛道词表 + 场景切换提示）
- [x] 5 个命令（on/off/red/blue/status）
- [x] 3 个 Skill（内核全文/红队/蓝队，description 精心撰写）
- [x] `AGENTS.md`（≤100 行）、`ARCHITECTURE.md`、`docs/` 各规范文件
- [x] 结构测试 + lint（第一批品味不变式）+ CI 骨架
- [x] 本地安装实测（2026-10-14 完成，见下）
  - marketplace 注册 + 安装成功：`ctf@cc-clawgod-ctf-plugin` v0.1.0（scope: user）
  - 安装路径：`~/.claude/plugins/cache/cc-clawgod-ctf-plugin/ctf/0.1.0`（marketplace 会把 plugin/ 内容平铺到缓存根）
  - SessionStart hook 实测：输出 3404 字符 JSON（首启引导+常驻层），systemMessage 正常
  - UserPromptSubmit 实测：红队词命中注入 / 蓝队词命中+场景切换提示 / 闲聊静默 / 触发词静默
  - 开关实测：off → session-start 输出 0 字节（连跑两次含 /clear 模拟）；on → 恢复 4293 字符
  - 首启引导实测：第一次 1 次、第二次 0 次（只出现一次生效）
- [x] 版本一致性：plugin.json 单一声明点 + bump 脚本
- [x] `prompt-history.txt` 机制落地

## 决策日志

| 日期 | 决策 | 理由 |
|---|---|---|
| 2026-10-14 | 技术栈 = 纯 Node.js 零依赖 | 用户三候选中选 A；与 claude-code-zh-cn 同构 |
| 2026-10-14 | 三层注入架构 | hook 注入 10,000 字符硬上限 + 官方机制匹配，见 requirements.md §2 |
| 2026-10-14 | 去除 A2 授权边界句 / A3 权限说明 / D11 自动放行 | 用户明确决策，记入 requirements.md §6 |
| 2026-10-14 | 插件名 `ctf` | 命令前缀短，打字省力 |

## 进度日志

| 日期 | 进展 | 阻塞 |
|---|---|---|
| 2026-10-14 | 需求澄清完成；requirements/CI/core-beliefs 落盘 | 无 |

## 关联

- 需求：`docs/requirements.md`
- 源提示词原件：`docs/references/AGENTS-source-gbk-corrupted.md`
- 修复后提示词：`docs/references/ct-attack-defense-prompt-v3.md`
- CI 决定：`docs/CI.md`
