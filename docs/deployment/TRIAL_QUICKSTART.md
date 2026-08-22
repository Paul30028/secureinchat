# 试用版快速上手

目标：让小团队今天就能用上。已经验证过的：`npm run build` 通过（221KB，gzip 69KB），
构建产物可正常托管，relay 与客户端的加密收发有跨进程集成测试覆盖。

## ⚠️ 先读这一条：必须是 HTTPS/WSS，不能用局域网 HTTP

浏览器的 Web Crypto（`crypto.subtle`）**只在安全上下文下可用**——HTTPS 或
`localhost`。这意味着：

- ❌ `http://192.168.1.5:8080` 让同事在局域网打开 → `crypto.subtle` 是 undefined，
  加密全挂，应用直接报错
- ❌ 页面 HTTPS + relay 用 `ws://` → 混合内容被浏览器拦截
- ✅ 页面 HTTPS + relay `wss://` → 正常

所以 relay 和网页**两个都要走 HTTPS/WSS**。下面的方案 A 用一条 Cloudflare Tunnel
同时解决。

---

## 方案 A（推荐）：Cloudflare Tunnel，团队任何地方都能用

### 1. 服务器上跑 relay

照 `DEPLOY_RELAY.md` 部署，监听 `127.0.0.1:8766`（和你现有生产的 8765 分开）。

### 2. 构建网页并托管

```bash
cd apps/android-client
VITE_RELAY_URL=wss://ws-next.secureinchat.com npm run build
# 产物在 dist/，用 nginx/caddy 托管，或者：
npx serve dist -l 8080
```

**关键**：`VITE_RELAY_URL` 必须在构建时设置（Vite 是编译期注入，不是运行时读取），
且必须是 `wss://`。

### 3. Tunnel 里加两条 hostname

```yaml
ingress:
  - hostname: ws.secureinchat.com          # 生产，不要动
    service: http://127.0.0.1:8765
  - hostname: ws-next.secureinchat.com     # 新 relay
    service: http://127.0.0.1:8766
  - hostname: app-next.secureinchat.com    # 网页
    service: http://127.0.0.1:8080
  - service: http_status:404
```

团队打开 `https://app-next.secureinchat.com` 即可。

---

## 方案 B（最快，仅限自测）：全部跑在本机

只想先自己验证能不能用，不用配任何域名：

```bash
# 终端 1：relay
cd server/relay && ./.venv/bin/python main.py

# 终端 2：网页（默认就指向 ws://localhost:8765）
cd apps/android-client && npm run dev
```

浏览器开 `http://localhost:5173`。`localhost` 算安全上下文，所以 Web Crypto 可用。
开两个窗口（其中一个用无痕模式，否则共享同一份 IndexedDB 身份）就能自己和自己
对话，验证收发。

---

## 怎么用

1. 一个人点「创建群聊」，输入群名，拿到邀请码
2. 把邀请码发给其他人（微信/邮件都行，它本身不是明文密钥泄露风险外的额外风险——
   但注意：**谁拿到这串码谁就能进群并解密**，别贴到公开地方）
3. 其他人打开网页，粘贴进「输入邀请码」→ 确认加入 → 进入群聊

## 试用版的已知限制（说在前面，免得被当成 bug）

- **只有文字消息**：图片、语音、文件、通话都还没做
- **没有历史消息**：刷新页面后消息清空（设备身份和群密钥会保留，消息不会）
- **只有一个群**：消息列表里只显示当前加入/创建的那个群
- **relay 没有成员资格校验**：任何人只要有邀请码就能连，服务端不校验"这个群是否
  真的存在"——小范围可信团队可以接受，别对外公开
- **relay 重启数据清空**：设备注册表是内存态的，进程重启后大家需要重连（客户端会
  自动 fallback 处理，但服务端不记得旧设备了）
- **不是 Android APK**：这是网页版。真机 APK 需要 Android SDK 环境构建，本仓库的
  Capacitor 配置已就绪但未在真机验证过
