# 可靠性要求

- hook 失败绝不阻塞会话：所有 hook 以 try/catch 包裹，异常输出最小 fallback 后 exit 0
- 状态文件损坏（手改/截断）：readJson 静默回退默认值，不抛错
- 目录不可写（只读安装）：stateDir 逐候选降级，最终 null 时状态不持久但功能可用
- stdin 非法 JSON：静默 exit 0（有测试守护：tests/hooks.test.js「畸形输入」）
- 注入超限：>10000 字符时截断并标注（正常路径由结构测试守护不发生）
- 平台一致性：CI 三平台（ubuntu/windows/macos）跑同一测试矩阵，fail-fast: false
