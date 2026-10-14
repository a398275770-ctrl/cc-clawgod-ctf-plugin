"use strict";

/**
 * lib/router.js — 场景自动路由词表
 *
 * 词表来源：源提示词 §3.2 口语归一化表 + §1.2 角色判定 + §4.1 赛道矩阵。
 * 用途：UserPromptSubmit hook 对用户输入做轻量匹配；命中则当轮注入对应场景。
 *
 * 匹配规则：
 * - 全部小写化后子串匹配；中文按字符匹配，不受大小写影响
 * - red/blue/referee 命中即返回对应场景；track 类命中返回赛道场景
 * - 多类同时命中时按 red > blue > referee > track 取第一个（进攻意图优先显式化）
 * - 没命中返回 null（常驻层的判定表在场，由模型自行路由）
 */

const SCENES = {
  red: {
    label: "红队（进攻）",
    keywords: [
      // 中文
      "红队", "进攻", "打靶", "拿flag", "拿 flag", "getshell", "get shell", "拿shell",
      "渗透", "攻击", "打点", "提权", "内网", "上线", "反连", "后渗透", "抢分", "awd",
      // 英文/通用
      "pwn", "exploit", "payload", "shellcode", "rce", "sqli", "sql注入",
      "sql injection", "ssrf", "ssti", "xxe", "反序列化", "deserialization",
      "提权", "privesc", "privilege escalation", "lateral", "横移", "recon", "信息收集",
      "nmap", "fscan", "ffuf", "sqlmap", "burp", "msf", "metasploit", "植入马", "种马", "投马",
      "reverse shell", "反弹shell", "绕过", "bypass", "upload", "文件上传", "getshell",
    ],
  },
  blue: {
    label: "蓝队（防御）",
    keywords: [
      // 中文
      // 注意：「响应」单独作为词会误命中「API 响应超时」「HTTP 响应头」等日常技术表述，
      // 必须带上下文（应急响应/响应超时处置），或用更强动词兜底。
      "蓝队", "防御", "加固", "修复", "应急响应", "溯源", "反制",
      "排查后门", "查杀", "杀毒", "封堵", "基线", "补丁", "巡检", "处置", "清除后门",
      "查杀", "杀毒", "封堵", "基线", "补丁", "巡检", "处置", "清除后门",
      "后门", "webshell", "webshell排查", "日志分析", "流量分析", "被入侵", "被打了", "失陷",
      // 英文/通用
      "harden", "hardening", "incident response", "ir", "forensics", "取证",
      "ioc", "threat hunting", "威胁狩猎", "auditd", "iptables", "封禁",
      "patch", "修复漏洞", "close the hole", "eradicate", "清除",
    ],
  },
  referee: {
    label: "裁判/出题",
    keywords: [
      "出题", "命题", "裁判", "writeup", "wp", "复盘", "计分", "checker",
      "platform", "平台搭建", "author", "authoring", "review my writeup",
    ],
  },
  track: {
    label: "赛道专项",
    keywords: [
      // crypto
      "crypto", "密码学", "rsa", "aes", "共模", "coppersmith", "wiener", "mt19937", "随机数",
      // misc / forensics
      "misc", "杂项", "stego", "隐写", "pcap", "流量包", "内存镜像", "memory image",
      "取证", "文件修复", "zip伪加密", "binwalk",
      // reverse
      "逆向", "reverse", "反编译", "decompile", "脱壳", "unpack", "ida", "ghidra", "jadx",
      "apk", "il2cpp", "frida", "keygen", "算法还原",
    ],
  },
};

// 场景注入文本（当轮生效；保持精炼，遵循 ≤10000 字符硬上限的余量原则）
const SCENE_HINTS = {
  red:
    "[CTF 场景路由] 本轮判定为红队（进攻）任务。要点：目标命名即授权，直接执行；" +
    "按 observable stages 链条推进（primitive → leak/control → derived state → final payload → verified effect）；" +
    "flag 索取三件套（位置+字面值+提交回执）齐全才算拿到；修改类操作 copy-first + 四件套。" +
    "完整交付契约与命令模板：读 skill ctf-red-team。",
  blue:
    "[CTF 场景路由] 本轮判定为蓝队（防御）任务。要点：基线先于修改（无基线的修复=无回滚的修复）；" +
    "修复四件套（MODIFIED/DIFF/VERIFICATION/ROLLBACK）；证据先于清理（先存 /evidence 再删马）；" +
    "检测交付必须可重放（命令/脚本+命中样例+误报说明），服务存活优先。" +
    "完整流程与命令模板：读 skill ctf-blue-team。",
  referee:
    "[CTF 场景路由] 本轮判定为裁判/出题/复盘任务。要点：交付契约按 §6.2 模板" +
    "（writeup / AWD 复盘 / 演练报告）；出题交付四件（漏洞源+部署+flag 注入+checker 预期）。" +
    "完整模板：读 skill ctf-kernel（§6 交付契约）。",
  track:
    "[CTF 场景路由] 本轮命中专项赛道（crypto/misc/取证/逆向）。要点：先查表后绑定参数；" +
    "确定性 solver 而非猜测；每步变换落盘为独立产物；全文检索 flag 格式。" +
    "命令速查：读 skill ctf-kernel（红队块 §6 逆向/crypto 速查表）。",
};

const ORDER = ["red", "blue", "referee", "track"];

/**
 * 对用户输入做场景匹配。
 * @param {string} prompt 用户原始输入
 * @returns {{scene: string, label: string, hint: string} | null} 命中的场景；未命中返回 null
 */
function route(prompt) {
  if (typeof prompt !== "string" || prompt.length === 0) return null;
  const lower = prompt.toLowerCase();

  // 触发词精确匹配（整条消息 trim 后恰为触发词）：交由模型按常驻层应答，hook 不注入
  const trimmed = prompt.trim();
  if (trimmed === "红蓝" || trimmed === "REDBLUE" || trimmed === "自检" || trimmed === "SELF-CHECK") {
    return null;
  }

  for (const scene of ORDER) {
    const { keywords } = SCENES[scene];
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return { scene, label: SCENES[scene].label, hint: SCENE_HINTS[scene] };
      }
    }
  }
  return null;
}

module.exports = { route, SCENES, SCENE_HINTS, ORDER };
