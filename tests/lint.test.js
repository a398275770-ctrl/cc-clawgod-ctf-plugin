"use strict";

/**
 * lint.test.js — 第一批品味不变式（T1 文件大小 / T3 命名 / 文档交叉链接）
 * 报错信息内嵌修复指令（§6.2 自纠正闭环）。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function walk(dir, ext, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, acc);
    else if (p.endsWith(ext)) acc.push(p);
  }
  return acc;
}

test("T1 文件大小限制：JS 源码 ≤400 行", () => {
  for (const p of walk(ROOT, ".js")) {
    const lines = fs.readFileSync(p, "utf8").split("\n").length;
    assert.ok(
      lines <= 400,
      `${path.relative(ROOT, p)} 有 ${lines} 行（上限 400）。\n` +
        `修复：拆分为更小的模块——一个文件一个职责。`
    );
  }
});

test("T1 文件大小限制：markdown 文档 ≤600 行（AGENTS.md 另限 100 行）", () => {
  // HARNESS-RULES.md 是施工图（规则 §16：阶段 A–F 完成前不得删改，竣工时归档到
  // docs/exec-plans/completed/），豁免行数限制；归档后此豁免由结构测试守护失效。
  const EXEMPT = new Set(["docs/HARNESS-RULES.md", "docs/new-project-harness-rules.md"]);
  for (const p of walk(ROOT, ".md")) {
    const rel = path.relative(ROOT, p).split(path.sep).join("/");
    if (EXEMPT.has(rel)) continue;
    if (rel.includes("references") || rel.startsWith("plugin/skills")) continue;
    const lines = fs.readFileSync(p, "utf8").split("\n").length;
    const limit = rel === "AGENTS.md" ? 100 : 600;
    assert.ok(
      lines <= limit,
      `${rel} 有 ${lines} 行（上限 ${limit}）。\n` +
        `修复：AGENTS.md 只做目录不做百科；其他文档把一次性内容移入 docs/exec-plans/completed/。`
    );
  }
});

test("T9 文档交叉链接：AGENTS.md 引用的文件必须存在", () => {
  const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  const refs = [...agents.matchAll(/`([\w./-]+\.(?:md|json|js))`/g)].map((m) => m[1]);
  for (const ref of refs) {
    const p = path.join(ROOT, ref);
    assert.ok(
      fs.existsSync(p),
      `AGENTS.md 引用的 \`${ref}\` 不存在。\n修复：修正路径或创建该文件（知识必须真实存在，看不到=不存在）。`
    );
  }
});

test("T3 命名约定：plugin 目录内 JS 文件 kebab-case", () => {
  const pluginDir = path.join(ROOT, "plugin");
  for (const p of walk(pluginDir, ".js")) {
    const base = path.basename(p, ".js");
    assert.match(
      base,
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      `${path.relative(ROOT, p)} 文件名不符合 kebab-case。\n修复：重命名为小写中划线形式。`
    );
  }
});

test("hook 源码零第三方依赖（只用 node: 前缀内置模块）", () => {
  const pluginDir = path.join(ROOT, "plugin");
  for (const p of walk(pluginDir, ".js")) {
    const src = fs.readFileSync(p, "utf8");
    const requires = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
    for (const r of requires) {
      assert.ok(
        r.startsWith("node:") || r.startsWith(".") || r.startsWith("/"),
        `${path.relative(ROOT, p)} 引入了非内置依赖 \`${r}\`。\n` +
          `修复：本项目零运行时依赖——用 node: 内置模块实现，或把能力放进 hooks/lib/。`
      );
    }
  }
});
