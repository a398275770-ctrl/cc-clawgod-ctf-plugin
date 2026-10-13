"use strict";

/**
 * lib/state.js — 插件状态管理（软开关 + 场景记忆）
 *
 * 状态文件放 CLAUDE_PLUGIN_DATA（跨插件更新持久）；
 * 取不到该变量时退化到插件目录（仅影响状态持久性，不影响功能）。
 */

const fs = require("node:fs");
const path = require("node:path");

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");

function stateDir() {
  const candidates = [
    process.env.CLAUDE_PLUGIN_DATA,
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

// 默认状态：开启（defaultEnabled），无记忆场景
function getState() {
  return readJson(PLUGIN_STATE, { enabled: true, forcedScene: null, lastScene: null });
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
