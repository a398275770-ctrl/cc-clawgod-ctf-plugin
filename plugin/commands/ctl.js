#!/usr/bin/env node

/**
 * ctl.js — 插件命令的统一状态操作入口（/ctf:on|off|red|blue|status 复用）
 *
 * 为什么不用命令 markdown 里内联 node -e：
 * 内联脚本拿不到 CLAUDE_PLUGIN_ROOT 的环境展开（命令执行时该变量未必存在），
 * 会把状态文件误写到当前工作目录的 .state/ 下，导致开关完全失效（真实踩坑）。
 * 本脚本从自身路径推导 PLUGIN_ROOT，与 hook 的 state.js 逻辑保持一致。
 */

"use strict";

const path = require("node:path");
const state = require(path.join(__dirname, "..", "hooks", "lib", "state.js"));

const action = process.argv[2];

function show(s) {
  const enabled = s.enabled ? "开启" : "关闭";
  const forced = s.forcedScene || "无（自动路由）";
  const last = s.lastScene || "无记录";
  console.log(`注入开关：${enabled}`);
  console.log(`强制场景：${forced}`);
  console.log(`最近命中：${last}`);
}

switch (action) {
  case "off":
    state.setState({ enabled: false, forcedScene: null });
    console.log("disabled");
    break;
  case "on":
    state.setState({ enabled: true });
    console.log("enabled");
    break;
  case "red":
    state.setState({ enabled: true, forcedScene: "红队", lastScene: "red" });
    console.log("red-forced");
    break;
  case "blue":
    state.setState({ enabled: true, forcedScene: "蓝队", lastScene: "blue" });
    console.log("blue-forced");
    break;
  case "status":
    show(state.getState());
    break;
  default:
    console.error("用法: node ctl.js <on|off|red|blue|status>");
    process.exit(1);
}
