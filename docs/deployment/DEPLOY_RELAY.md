# 部署 server/relay 给小团队试用

跟着你那份生产文档(`relay_production_notes.md`)里已经验证过的模式来:
VPS 上跑 relay(只监听 `127.0.0.1`)+ Cloudflare Tunnel 把它暴露成 `wss://`。
**不碰 `ws.secureinchat.com`**——这次部署用一个新的子域名,和现有生产节点完全分开。

这一步需要你在自己控制的服务器上操作,我这边的沙箱环境做不了(没有持久化的公网主机)。

## 前提

- 一台你能 SSH 上去的服务器(VPS 或你现有的那台跑生产 relay 的机器都行,只要能再开一个端口)
- Python 3.12+
- 一个 Cloudflare 托管的域名,能建 Tunnel(和生产用的应该是同一个 Cloudflare 账号/域名)
- 已装好 `cloudflared`(如果生产 relay 已经在跑,这台机器大概率已经装过)

## 1. 部署代码

```bash
git clone https://github.com/Paul30028/secureinchat.git
cd secureinchat
git checkout feature/protocol-crypto-core-scaffold-push   # 这次开发用的分支，PR #1 对应的那个

cd server/relay
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

## 2. 用 systemd 常驻运行

新建 `/etc/systemd/system/secureinchat-relay-next.service`(注意起了一个和生产
不一样的服务名，避免手滑碰到旧的那个）：

```ini
[Unit]
Description=SecureInChat Next - Blind Relay (dev/trial)
After=network.target

[Service]
Type=simple
User=YOUR_LINUX_USER
WorkingDirectory=/path/to/secureinchat/server/relay
Environment=SECUREINCHAT_RELAY_PORT=8766
ExecStart=/path/to/secureinchat/server/relay/.venv/bin/python main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

端口特意用 `8766`(生产是 `8765`),同一台机器上两个 relay 不会撞端口。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now secureinchat-relay-next
sudo systemctl status secureinchat-relay-next   # 确认 active (running)，日志里能看到 "READY"
```

## 3. Cloudflare Tunnel：加一个新 hostname

在你现有的 tunnel 配置里加一条（不要改动指向 `ws.secureinchat.com` 那条）：

```yaml
ingress:
  - hostname: ws.secureinchat.com        # 生产，不要动
    service: http://127.0.0.1:8765
  - hostname: ws-next.secureinchat.com   # 新加的，给这次试用用
    service: http://127.0.0.1:8766
  - service: http_status:404
```

`ws-next` 只是个建议名字，你可以换成别的（比如 `ws-trial`），只要别和生产的重名。

```bash
sudo systemctl restart cloudflared    # 或者你管理 cloudflared 的方式
```

## 4. 验证（照抄你那份文档第 5 节的方法）

```bash
wscat -c wss://ws-next.secureinchat.com
```

能收到 `{"type": "auth_challenge", "nonce": "..."}` 就说明 DNS / TLS / Tunnel /
WebSocket 全链路通了——和生产 relay 当初验证的是同一套方法。

## 已知限制（如实说，别抱预期）

- `main.py` 目前**没有配 `membership`/`invite_registry`**——任何设备只要走完
  `register_device` 握手，claim 哪个 `groupId` 就能进哪个"群"，没有真正的成员
  资格校验。小范围可信的团队试用能接受，正式对外一定要在部署前把这两个接上
  （代码已经有了，只是 `main.py` 这个开发入口没启用，见
  `docs/protocol/RELAY_CONTRACT_V0.md`）
- 没有限流、没有监控告警、没有多中继 fallback
- App 客户端目前还没接上 `RelayClient`——部署完 relay 之后，还差"客户端真的连
  上它、能收发消息"这一步，是下一个切片
