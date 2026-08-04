# 在现有 VPS 上并行部署新中继

**前提确认**（已用 `scripts/probe-relay-protocol.py` 验证）：
生产中继 `wss://ws.secureinchat.com` 跑的是旧协议（`auth_challenge` 带
`challenge` 字段），新客户端说的是新协议（带 `nonce`），两者不通。
所以要在同一台机器上再跑一个新中继，**生产的那个一行都不动**。

目标状态：

```
ws.secureinchat.com       →  127.0.0.1:8765   旧中继（生产，不动）
ws-next.secureinchat.com  →  127.0.0.1:8766   新中继（本项目）
```

---

## 1. 部署代码

SSH 到 VPS：

```bash
cd /opt          # 或你习惯放服务的目录
sudo git clone -b feature/protocol-crypto-core-scaffold-push \
  https://github.com/Paul30028/secureinchat.git secureinchat-next
cd secureinchat-next/server/relay

python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

先手动跑一下确认能起来：

```bash
SECUREINCHAT_RELAY_PORT=8766 ./.venv/bin/python main.py
```

看到 `READY` 就是好的，Ctrl+C 停掉，继续下一步。

## 2. 做成 systemd 服务

```bash
sudo tee /etc/systemd/system/secureinchat-next.service > /dev/null << 'EOF'
[Unit]
Description=SecureInChat Next Relay (trial)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/secureinchat-next/server/relay
Environment=SECUREINCHAT_RELAY_PORT=8766
ExecStart=/opt/secureinchat-next/server/relay/.venv/bin/python main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now secureinchat-next
sudo systemctl status secureinchat-next
```

**服务名特意叫 `secureinchat-next`**，和生产那个不同名，避免手滑重启错了服务。

## 3. Cloudflare Tunnel 加一条 hostname

找到现有配置（通常是 `/etc/cloudflared/config.yml` 或 `~/.cloudflared/config.yml`）：

```bash
sudo cat /etc/cloudflared/config.yml
```

在 `ingress:` 里**新增中间那条**，不要动第一条：

```yaml
ingress:
  - hostname: ws.secureinchat.com          # 生产，保持原样
    service: http://127.0.0.1:8765
  - hostname: ws-next.secureinchat.com     # 新增
    service: http://127.0.0.1:8766
  - service: http_status:404               # 这条必须永远在最后
```

然后在 Cloudflare 控制台给 `ws-next` 加一条 DNS 记录（CNAME 指向你的 tunnel，
和 `ws` 那条一样的做法），再重启：

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

## 4. 验证

在你的 Windows 机器上：

```powershell
python scripts/probe-relay-protocol.py wss://ws-next.secureinchat.com
```

应该输出：

```
✅ 字段是 `nonce` —— 这就是我们的新协议，新 APK 可以直接连这个地址。
```

顺便再确认生产没受影响：

```powershell
python scripts/probe-relay-protocol.py wss://ws.secureinchat.com
```

还是输出 `challenge`（旧协议）就对了 —— 说明生产没被动过。

## 5. 在 APK 里填地址

装上 APK → 启动页点「服务器设置」→ 填 `wss://ws-next.secureinchat.com` → 保存。

不需要重新打包，地址保存在手机本地。

---

## 出问题时怎么查

**探测脚本报连接失败**：
```bash
sudo systemctl status secureinchat-next     # 中继本身活着吗
sudo journalctl -u cloudflared -n 50        # tunnel 有没有报错
curl -i http://127.0.0.1:8766               # 本机直连，应该返回 426 Upgrade Required
```

`426 Upgrade Required` 是**正常的**——说明 WebSocket 服务在正常等待
upgrade，和你之前测生产时看到的一样。

**APK 里连不上但探测脚本能通**：检查填的地址是不是 `wss://`（不是 `ws://`）。
应用会在填错时直接提示，但如果之前存过错的地址，进「服务器设置」重填一次。

## 这个试用中继的已知限制

- **没有成员资格校验**：`main.py` 没启用 `membership` / `invite_registry`，任何
  设备只要走完握手，claim 哪个 groupId 就能进哪个群。小范围可信团队试用可以
  接受，**不要对外公开这个地址**。
- **设备注册表是内存态**：`systemctl restart` 之后所有设备需要重连（客户端会
  自动 fallback 处理，用户无感）。
- **没有限流**：地址泄露出去会被人白嫖带宽。
- **通话跨运营商还需要 TURN**：见 `docs/deployment/DEPLOY_TURN.md`。中继本身
  只转发文字/图片/文件的密文，音视频流不走它。
