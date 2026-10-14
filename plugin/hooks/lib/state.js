"use strict";

/**
 * lib/state.js — 插件状态管理（软开关 + 场景记忆）
 *
 * 状态目录优先级（必须与 hook、命令两条路径完全一致，否则开关失效）：
 *   1. env CLAUDE_PLUGIN_DATA（hook 执行时 Claude Code 注入）
 *   2. ~/.claude/plugins/data/<plugin-id>/（命令执行时无 env，按官方规则推导）
 *   3. 插件目录 .state/（最后兜底；不可写也不影响功能，只是状态不持久）
 *
 * 真实踩坑（2026-10-13）：命令里内联 node -e 无 env 时把状态写进 cwd/.state/，
 * 与 hook 读的位置不一致，/ctf:off 完全失效。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// state.js 位于 <plugin-root>/hooks/lib/，上溯两级即插件根。
// 不再依赖 CLAUDE_PLUGIN_ROOT（命令执行环境没有该变量）。
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");

// 插件 id = "<plugin-name>@<marketplace-name>"，对应 data 目录名
// （与官方安装实例一致：~/.claude/plugins/data/ctf-cc-clawgod-ctf-plugin/）
const PLUGIN_ID = process.env.CLAUDE_PLUGIN_ID || "ctf-cc-clawgod-ctf-plugin";

function defaultDataDir() {
  return path.join(os.homedir(), ".claude", "plugins", "data", PLUGIN_ID);
}

function stateDir() {
  const candidates = [
    process.env.CLAUDE_PLUGIN_DATA,
    defaultDataDir(),
    path.join(PLUGIN_ROOT, ".state"),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      // 目录不可写则尝试下一个候选
    }
  }
  return null;
}

function stateFile(name) {
  const dir = stateDir();
  return dir ? path.join(dir, name) : null;
}

function readJson(name, fallback) {
  const file = stateFile(name);
  if (!file) return fallback;
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  const file = stateFile(name);
  if (!file) return false;
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

const PLUGIN_STATE = "plugin-state.json";

// 默认状态：关闭（默认禁用、显式开启——用户决策 A，见 requirements.md 决策 #13）。
// 用户安装插件是意图，但「自动改变模型行为」须经一次显式同意（/ctf:on）。
function getState() {
  return readJson(PLUGIN_STATE, { enabled: false, forcedScene: null, lastScene: null });
}

function setState(patch) {
  const next = { ...getState(), ...patch };
  writeJson(PLUGIN_STATE, next);
  return next;
}

// 首次运行标记（首次引导只出现一次）
function markFirstRunDone() {
  const file = stateFile(".first-run-done");
  if (file && !fs.existsSync(file)) {
    try {
      fs.writeFileSync(file, new Date().toISOString(), "utf8");
    } catch {
      // 写不进就下次再引导一次，无害
    }
  }
}

function isFirstRun() {
  const file = stateFile(".first-run-done");
  return !file || !fs.existsSync(file);
}

function readAsset(name) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, "assets", name), "utf8");
}

module.exports = { PLUGIN_ROOT, getState, setState, isFirstRun, markFirstRunDone, readAsset };
