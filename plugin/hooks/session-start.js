#!/usr/bin/env node

/**
 * session-start.js — SessionStart hook：常驻场景层注入
 *
 * 职责：
 * 1. 检查软开关；off 时静默退出（不注入任何内容）
 * 2. 注入常驻场景层（内核十条 + 角色判定 + Skill 索引）
 * 3. 首次运行追加使用引导（只出现一次）
 * 4. 强制场景（/ctf:red|blue 设置）优先于常驻层提示
 *
 * matcher: startup|resume|clear|compact —— clear/compact 后自动重注入，纪律永远在场。
 */

const { getState, isFirstRun, markFirstRunDone, readAsset } = require("./lib/state");

function output(context, systemMessage) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  };
  if (systemMessage) payload.systemMessage = systemMessage;
  process.stdout.write(JSON.stringify(payload));
}

function main() {
  const state = getState();
  if (!state.enabled) {
    // 软开关关闭（默认态）：不注入场景内容，只做一次性「如何开启」引导。
    // 引导同样走 additionalContext 通道，但内容只是插件使用说明，不是场景规则——
    // 不改变模型行为，只告诉用户开关的存在（用户决策 A：默认禁用、显式开启）。
    if (isFirstRun()) {
      markFirstRunDone();
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext:
            "[CTF 插件已安装，默认关闭] 本插件为 CTF/AWD/红蓝演练提供场景注入：\n" +
            "- 输入 /ctf:on 开启（开启后自动识别红队/蓝队场景并注入对应纪律）\n" +
            "- 输入 /ctf:status 查看状态；/ctf:off 可随时关闭\n" +
            "- 关闭前：/ctf:red 强制红队 · /ctf:blue 强制蓝队\n" +
            "本提示只出现一次，不会修改你的任何设置。",
        },
        systemMessage: "[CTF] 插件已安装，默认关闭（/ctf:on 开启）",
      }));
    }
    process.exit(0);
  }

  const parts = [];

  // 首次引导放最前（只出现一次）
  if (isFirstRun()) {
    parts.push(readAsset("first-run-guide.md").trim());
    markFirstRunDone();
  }

  parts.push(readAsset("resident-layer.md").trim());

  // 强制场景提示（/ctf:red 或 /ctf:blue 之后的新会话）
  if (state.forcedScene) {
    parts.push(
      `[CTF 强制场景] 用户已手动指定本会话固定为「${state.forcedScene}」模式；` +
        `角色判定不必再做，直接按该模式的完整纪律执行（对应 skill：ctf-${state.forcedScene === "红队" ? "red-team" : "blue-team"}）。`
    );
  }

  const context = parts.join("\n\n---\n\n");

  // additionalContext 硬上限 10000 字符；超限会被替换为文件路径+预览（等于没注入）
  if (context.length > 10000) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context.slice(0, 9800) + "\n[注意：场景上下文超限被截断，请读 skill ctf-kernel 获取完整内核]",
      },
      systemMessage: "[CTF] 常驻层超限被截断（异常情况，请报告插件问题）",
    }));
    process.exit(0);
  }

  output(context, "[CTF] 攻防场景已激活（红蓝自动路由就绪）");
}

try {
  main();
} catch (err) {
  // hook 失败绝不阻塞会话：输出最小可用上下文
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "[CTF 插件] 场景注入本次未运行（hook 异常），请按 CTF 惯例执行任务。",
    },
  }));
  process.stderr.write(String(err && err.stack || err));
  process.exit(0);
}
