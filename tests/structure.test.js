"use strict";

/**
 * structure.test.js — 结构测试：插件形态合法性（架构约束的机械强制）
 *
 * 覆盖：
 * - manifest / hooks.json 结构合法性
 * - hooks 全部 node 直调（Windows 兼容硬约束）
 * - 注入文本 ≤ 硬上限
 * - skill 三层齐全、description 非空
 * - 命令五件套齐全
 * - 状态文件不落插件安装目录（代码级检查）
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN = path.join(ROOT, "plugin");

const CONTEXT_HARD_LIMIT = 10000;
const RESIDENT_BUDGET = 6500;

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function json(p) {
  return JSON.parse(read(p));
}

test("manifest 存在且 name 为 ctf", () => {
  const m = json(path.join(PLUGIN, ".claude-plugin", "plugin.json"));
  assert.equal(m.name, "ctf");
  assert.match(m.name, /^[a-z0-9-]+$/);
  assert.ok(m.version, "version 必填");
  assert.ok(m.description, "description 必填");
});

test("hooks.json 顶层含 hooks 包装", () => {
  const h = json(path.join(PLUGIN, "hooks", "hooks.json"));
  assert.ok(h.hooks, "hooks 文件必须有顶层 hooks key（无包装则加载失败）");
  assert.ok(Array.isArray(h.hooks.SessionStart));
  assert.ok(Array.isArray(h.hooks.UserPromptSubmit));
});

test("所有 hook 命令均为 node 直调（Windows 兼容硬约束）", () => {
  const h = json(path.join(PLUGIN, "hooks", "hooks.json"));
  for (const entries of Object.values(h.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        assert.equal(hook.type, "command");
        assert.equal(hook.command, "node", "hook 必须用 node 直调，禁止 bash/ps1（Windows 兼容）");
        assert.ok(
          hook.args.every((a) => !a.includes("\\") || a.includes("${CLAUDE_PLUGIN_ROOT}")),
          "hook args 路径不得硬编码平台分隔符"
        );
      }
    }
  }
});

test("SessionStart matcher 覆盖 startup|resume|clear|compact", () => {
  const h = json(path.join(PLUGIN, "hooks", "hooks.json"));
  const m = h.hooks.SessionStart[0].matcher;
  for (const k of ["startup", "resume", "clear", "compact"]) {
    assert.ok(m.includes(k), `SessionStart matcher 缺少 ${k}（clear/compact 后必须重注入）`);
  }
});

test("常驻层文本在预算内（硬上限 10000 字符）", () => {
  const resident = read(path.join(PLUGIN, "assets", "resident-layer.md"));
  assert.ok(
    resident.length <= RESIDENT_BUDGET,
    `常驻层 ${resident.length} 字符超出预算 ${RESIDENT_BUDGET}`
  );
  const guide = read(path.join(PLUGIN, "assets", "first-run-guide.md"));
  // 常驻层 + 首启引导 + 强制场景行 也要低于硬上限
  const total = resident.length + guide.length + 300;
  assert.ok(total <= CONTEXT_HARD_LIMIT, `常驻合计 ${total} 超 ${CONTEXT_HARD_LIMIT} 硬上限`);
});

test("三层 skill 齐全且 description 有效", () => {
  for (const name of ["ctf-kernel", "ctf-red-team", "ctf-blue-team"]) {
    const p = path.join(PLUGIN, "skills", name, "SKILL.md");
    assert.ok(fs.existsSync(p), `缺少 skill ${name}`);
    const body = read(p);
    const m = body.match(/^description:\s*(.+)$/m);
    assert.ok(m && m[1].length > 20, `skill ${name} description 过短（决定自动触发质量）`);
    const lines = body.split("\n").length;
    assert.ok(lines <= 600, `skill ${name} ${lines} 行，超过官方建议 500 行较多`);
  }
});

test("五个命令齐全且带 description（补全展示用）", () => {
  for (const c of ["on", "off", "red", "blue", "status"]) {
    const p = path.join(PLUGIN, "commands", `${c}.md`);
    assert.ok(fs.existsSync(p), `缺少命令 /ctf:${c}`);
    const body = read(p);
    assert.match(body, /^description:/m, `/ctf:${c} 缺 description（补全列表不显示解释）`);
  }
});

test("hook 源码不写插件安装目录做状态存储", () => {
  // 状态读写全部收敛在 lib/state.js，且必须优先 CLAUDE_PLUGIN_DATA
  const stateSrc = read(path.join(PLUGIN, "hooks", "lib", "state.js"));
  assert.match(
    stateSrc,
    /CLAUDE_PLUGIN_DATA/,
    "lib/state.js 必须使用 CLAUDE_PLUGIN_DATA 存状态"
  );
  // hook 入口不得绕过 state.js 直接写文件
  for (const f of ["hooks/session-start.js", "hooks/user-prompt-submit.js"]) {
    const src = read(path.join(PLUGIN, f));
    assert.ok(!/writeFileSync\(/.test(src), `${f} 不得直接写文件（状态归 state.js 管）`);
    assert.ok(
      !/readAsset\(["']|require\(["']\.\/lib\/state["']\)/.test(src) || src.includes("lib/state"),
      `${f} 状态操作应经由 lib/state`
    );
  }
});

test("路由词表覆盖全赛道", () => {
  const src = read(path.join(PLUGIN, "hooks", "lib", "router.js"));
  for (const scene of ["red", "blue", "referee", "track"]) {
    assert.ok(src.includes(`${scene}:`), `词表缺 ${scene} 场景`);
  }
  // 触发词精确匹配守护（修复后的乱码触发词不得回退）
  for (const kw of ["红蓝", "REDBLUE", "自检", "SELF-CHECK"]) {
    assert.ok(src.includes(kw), `router 触发词表缺 ${kw}`);
  }
});

test("assets 模块全文与 skill 内联一致（防漂移）", () => {
  const kernel = read(path.join(PLUGIN, "assets", "kernel-full.md"));
  const skill = read(path.join(PLUGIN, "skills", "ctf-kernel", "SKILL.md"));
  // skill 应包含 kernel 全文的核心段（十规则首行）
  assert.ok(skill.includes("Scenario assumption holds by default"));
  assert.ok(kernel.includes("Scenario assumption holds by default"));
});
