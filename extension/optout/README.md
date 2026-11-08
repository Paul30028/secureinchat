# SecureInChat Opt-Out（骨架）

本地优先的 Chrome MV3 扩展：按声明式规则把用户资料填进人员搜索网站的退出表单。
扩展不向任何服务器发送资料、浏览记录或进度；最终提交、CAPTCHA、邮件确认和证件
一律由用户本人完成，绝不绕过 CAPTCHA。

## 当前范围

- 只有 2 个本地模拟站点规则（`rules/demo.json`），不连接真实网站。
- `src/rules.js` 负责规则 schema、校验与站点匹配；`content/runner.js` 是注入页面的
  执行器。MV3 内容脚本不支持 ES module import，所以执行器保持自包含。
- 站点清单与真实规则待调研结果补入。
- `optional_host_permissions` 按任务要求留空数组。当前通过 `activeTab` 在用户
  刚操作过的标签页注入；真正做“运行时按站点授权”时，需要把各站点 origin 写进
  `optional_host_permissions`（Chrome 不允许申请未声明的可选权限）。
- `open` 步骤若填写 https URL，会导航离开当前页，需要上层重新注入 runner；
  当前两个模拟规则不使用该形式。

## 测试

```bash
node --test tests/optout/*.test.mjs
python tests/optout/e2e.py
```

本机沙箱里 Node 测试运行器无法 `spawn` 子进程，可用：

```bash
node --test --test-isolation=none tests/optout/*.test.mjs
```

E2E 需要 Python Playwright + Chromium，启动时加载 unpacked 扩展，在
`https://127.0.0.1:8765` 上起自签名 HTTPS 模拟站点，并拦截所有非本地请求。
没有桌面会话时用 `OPTOUT_HEADLESS=1`。若 Chromium 无法启动，请在普通桌面运行。
E2E 直接执行 `content/runner.js`（Playwright 无法点击工具栏 action 来授予
activeTab）；扩展加载、popup 启动和 runner 行为仍是真实的。popup 到
`chrome.scripting` 的注入链需要在普通 Chrome 中人工冒烟。
