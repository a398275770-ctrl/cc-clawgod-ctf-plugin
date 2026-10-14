"use strict";

/**
 * hooks.test.js — hook 行为测试：子进程跑真实 hook，校验 JSON 输出协议
 */

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN = path.join(ROOT, "plugin");

// 每个 case 用独立临时状态目录，互不污染
function runHook(hook, opts = {}) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctf-plugin-test-"));
  if (opts.enabled !== false) {
    // 默认态是 disabled（用户决策 A）；行为测试显式预置 enabled: true
    fs.writeFileSync(
      path.join(stateDir, "plugin-state.json"),
      JSON.stringify({ enabled: true }),
      "utf8"
    );
  }
  const r = spawnSync("node", [path.join(PLUGIN, "hooks", hook)], {
    input: opts.stdin ?? "",
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: PLUGIN,
      CLAUDE_PLUGIN_DATA: stateDir,
      ...(opts.env || {}),
    },
  });
  return { ...r, stateDir };
}

function parseHookStdout(r) {
  if (!r.stdout || r.stdout.trim() === "") return null;
  return JSON.parse(r.stdout);
}

test("session-start 默认关闭：不注入场景，只一次性引导开启", () => {
  // 用户决策 A（requirements.md #13）：默认禁用、显式开启。
  const r = runHook("session-start.js", { enabled: false });
  const out = parseHookStdout(r);
  assert.ok(out, "应有 JSON 输出");
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes("/ctf:on"), "默认态应引导用户开启");
  assert.ok(!ctx.includes("Execution Kernel"), "默认态不得注入场景规则");
  // 二次运行完全静默（引导只出现一次）
  const r2 = runHook("session-start.js", { env: { CLAUDE_PLUGIN_DATA: r.stateDir } });
  assert.equal(r2.stdout.trim(), "", "二次运行应完全静默");
});

test("session-start 开启后注入常驻层（含内核规则）", () => {
  const r = runHook("session-start.js");
  // 预置开启
  require("node:fs").writeFileSync(
    require("node:path").join(r.stateDir, "plugin-state.json"),
    JSON.stringify({ enabled: true }),
    "utf8"
  );
  const r2 = runHook("session-start.js", { env: { CLAUDE_PLUGIN_DATA: r.stateDir } });
  const out = parseHookStdout(r2);
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.ok(ctx.includes("执行内核"), "开启后应含内核规则");
  assert.ok(ctx.length <= 10000, "不得超硬上限");
  assert.ok(out.systemMessage, "状态可见性：应有 systemMessage");
});

test("session-start 在 off 时静默退出", () => {
  const r = runHook("session-start.js", { enabled: false });
  // 预置 off 状态：先跑一次开启再写 off
  const stateDir = r.stateDir;
  fs.writeFileSync(
    path.join(stateDir, "plugin-state.json"),
    JSON.stringify({ enabled: false }),
    "utf8"
  );
  const r2 = spawnSync("node", [path.join(PLUGIN, "hooks", "session-start.js")], {
    input: "",
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: stateDir },
  });
  assert.equal(r2.stdout.trim(), "", "off 时 stdout 必须为空（不注入）");
});

test("user-prompt-submit 红队词命中注入", () => {
  const r = runHook("user-prompt-submit.js", {
    stdin: JSON.stringify({ prompt: "帮我 pwn 这道题，目标是拿 flag" }),
  });
  const out = parseHookStdout(r);
  assert.ok(out, "红队词应命中");
  assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.ok(out.hookSpecificOutput.additionalContext.includes("红队"));
});

test("user-prompt-submit 蓝队词命中注入", () => {
  const r = runHook("user-prompt-submit.js", {
    stdin: JSON.stringify({ prompt: "服务器被种了 webshell，帮我排查加固" }),
  });
  const out = parseHookStdout(r);
  assert.ok(out);
  assert.ok(out.hookSpecificOutput.additionalContext.includes("蓝队"));
});

test("user-prompt-submit 普通闲聊不注入", () => {
  const r = runHook("user-prompt-submit.js", {
    stdin: JSON.stringify({ prompt: "你好，今天天气怎么样" }),
  });
  assert.equal(r.stdout.trim(), "", "未命中应静默");
});

test("user-prompt-submit 触发词不注入（留给模型应答）", () => {
  for (const t of ["红蓝", "REDBLUE", "自检", "SELF-CHECK"]) {
    const r = runHook("user-prompt-submit.js", { stdin: JSON.stringify({ prompt: t }) });
    assert.equal(r.stdout.trim(), "", `触发词 ${t} 不应由 hook 注入`);
  }
});

test("user-prompt-submit 场景切换提示（防串味）", () => {
  const first = runHook("user-prompt-submit.js", {
    stdin: JSON.stringify({ prompt: "nmap 扫一下这个靶机" }),
  });
  assert.ok(parseHookStdout(first), "第一轮红队命中");
  const second = spawnSync(
    "node",
    [path.join(PLUGIN, "hooks", "user-prompt-submit.js")],
    {
      input: JSON.stringify({ prompt: "现在帮我排查后门加固服务" }),
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: PLUGIN,
        CLAUDE_PLUGIN_DATA: first.stateDir,
      },
    }
  );
  const out = parseHookStdout(second);
  assert.ok(out, "第二轮蓝队命中");
  assert.ok(
    out.hookSpecificOutput.additionalContext.includes("场景切换"),
    "应含场景切换提示"
  );
});

test("user-prompt-submit off 时静默", () => {
  const r = runHook("user-prompt-submit.js", {
    stdin: JSON.stringify({ prompt: "帮我 pwn 它" }),
    enabled: false,
  });
  const stateDir = r.stateDir;
  fs.writeFileSync(
    path.join(stateDir, "plugin-state.json"),
    JSON.stringify({ enabled: false }),
    "utf8"
  );
  const r2 = spawnSync("node", [path.join(PLUGIN, "hooks", "user-prompt-submit.js")], {
    input: JSON.stringify({ prompt: "帮我 pwn 它" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: stateDir },
  });
  assert.equal(r2.stdout.trim(), "");
});

test("hook 对畸形输入不崩溃", () => {
  for (const bad of ["", "not-json", "{}", '{"prompt":null}', '{"prompt":123}']) {
    const r = runHook("user-prompt-submit.js", { stdin: bad });
    assert.equal(r.status, 0, `畸形输入 ${JSON.stringify(bad)} 应 exit 0`);
  }
});

test("router 赛道覆盖抽查", () => {
  const cases = [
    ["这题 rsa e 很大", "track"],
    ["出个 web 题并写 writeup", "referee"],
    ["fscan 扫内网", "red"],
    ["auditd 监控 flag 读取", "blue"],
    // 回归：日常技术表述不得误命中蓝队（真实会话踩过：「API 响应」命中「响应」）
    ["API 响应超时，请检查网络", null],
    ["HTTP 响应头里有什么", null],
    ["响应式设计怎么做", null],
    ["等待 API 响应 · 将在 2分34秒 后重试", null],
    // 上下文明确的蓝队词仍须命中
    ["应急响应演练怎么做", "blue"],
    ["排查一下后门", "blue"],
  ];
  const { route } = require(path.join(PLUGIN, "hooks", "lib", "router.js"));
  for (const [input, expected] of cases) {
    const hit = route(input);
    if (expected === null) {
      assert.equal(hit, null, `${input} 不应命中任何场景（防误判回归）`);
    } else {
      assert.ok(hit, `${input} 应命中`);
      assert.equal(hit.scene, expected, `${input} 应路由到 ${expected}`);
    }
  }
});
