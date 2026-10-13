#!/usr/bin/env node

/**
 * user-prompt-submit.js — UserPromptSubmit hook：每轮场景路由层
 *
 * 职责：
 * 1. 检查软开关；off 时静默退出
 * 2. 读取用户 prompt，用词表做场景匹配（红/蓝/裁判/赛道）
 * 3. 命中 → 当轮注入场景要点；与上轮场景不同时附加「场景已切换」提示（防串味）
 * 4. 未命中 → 静默退出（常驻层判定表在场，模型自行路由，不打扰）
 *
 * 注入只对当轮生效；已注入内容随 transcript 持久（这是 Claude Code 机制，无法中途擦除）。
 */

const { getState, setState } = require("./lib/state");
const { route } = require("./lib/router");

function main() {
  const state = getState();
  if (!state.enabled) process.exit(0);

  // stdin JSON: { prompt: "...", ... }
  let input = "";
  try {
    input = require("node:fs").readFileSync(0, "utf8");
  } catch {
    process.exit(0);
  }

  let prompt = "";
  try {
    const parsed = JSON.parse(input);
    prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
  } catch {
    process.exit(0);
  }

  if (!prompt) process.exit(0);

  const hit = route(prompt);
  if (!hit) process.exit(0);

  let context = hit.hint;

  // 场景切换检测：上一轮命中了不同场景 → 提示模型切换（防串味）
  const prev = state.lastScene;
  if (prev && prev !== hit.scene) {
    context =
      `[CTF 场景切换] 上轮场景：${prev}；本轮切换为：${hit.scene}。` +
      `请按新场景纪律执行，不要延续上一场景的交付形态。\n` +
      context;
  }
  if (prev !== hit.scene) setState({ lastScene: hit.scene });

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
    systemMessage: `[CTF] 已注入场景：${hit.label}`,
  }));
}

try {
  main();
} catch {
  // 路由失败静默退出：常驻层在场，模型仍可自行判定
  process.exit(0);
}
