#!/usr/bin/env node

/**
 * bump-version.js — 版本一致性：一次 bump 全部声明点（AGENTS.md 硬性约束）
 *
 * 单一版本来源：plugin/.claude-plugin/plugin.json 的 version。
 * 同步点：根 package.json、README.md 徽章（若存在 vX.YZ 字样）。
 *
 * 用法：node scripts/bump-version.js <new-version>   如 0.2.0
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "plugin", ".claude-plugin", "plugin.json");

function fail(msg) {
  process.stderr.write(`bump-version: ${msg}\n`);
  process.exit(1);
}

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  fail("用法: node scripts/bump-version.js <x.y.z>");
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const oldVersion = manifest.version;
if (oldVersion === newVersion) fail(`版本已是 ${newVersion}，无需 bump`);

manifest.version = newVersion;
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`plugin.json: ${oldVersion} -> ${newVersion}`);

const rootPkg = path.join(ROOT, "package.json");
if (fs.existsSync(rootPkg)) {
  const pkg = JSON.parse(fs.readFileSync(rootPkg, "utf8"));
  if (pkg.version && pkg.version !== newVersion) {
    pkg.version = newVersion;
    fs.writeFileSync(rootPkg, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log(`package.json: -> ${newVersion}`);
  }
}

// README 徽章同步（存在 vX.Y.Z 字样时）
const readme = path.join(ROOT, "README.md");
if (fs.existsSync(readme)) {
  let text = fs.readFileSync(readme, "utf8");
  const badge = new RegExp(`v${oldVersion.replace(/\./g, "\\.")}`, "g");
  if (badge.test(text)) {
    text = text.replace(badge, `v${newVersion}`);
    fs.writeFileSync(readme, text, "utf8");
    console.log(`README.md: -> v${newVersion}`);
  }
}

console.log("完成。请一并提交。");
