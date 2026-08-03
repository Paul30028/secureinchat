# 部署 TURN 服务器（跨运营商通话必需）

## 为什么必须要有

只配 STUN 时，WebRTC 靠 P2P 直连。中国移动、电信的手机网络普遍是运营商级
NAT（CGNAT），两端都在这种 NAT 后面时，P2P 打洞成功率很低——STUN 只能帮你
发现自己的公网地址，打不通的时候没有兜底。

**TURN 是媒体中继**：音视频流经由服务器转发，只要双方都能连上 TURN 服务器就能
通话。代价是带宽成本（音视频流量全部过你的服务器）和一点额外延迟。

旧仓库（secure-invite-chat）的 `iceServers: []` 是空的，从来没有配过 TURN——
所以旧版跨运营商通话不可能通过中继工作。

## 部署 coturn（推荐）

在你已有的 VPS 上（和 relay 同一台也行）：

```bash
sudo apt update && sudo apt install -y coturn
sudo systemctl enable coturn
```

编辑 `/etc/turnserver.conf`：

```conf
listening-port=3478
tls-listening-port=5349

# 换成你的公网 IP 和域名
external-ip=你的公网IP
realm=turn.secureinchat.com
server-name=turn.secureinchat.com

# 静态凭证（简单但长期有效；生产建议改用下面的临时凭证方案）
lt-cred-mech
user=secureinchat:换成一个强密码

# TLS 证书（用 certbot 申请，或复用 Cloudflare Origin 证书）
cert=/etc/letsencrypt/live/turn.secureinchat.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.secureinchat.com/privkey.pem

# 中继端口范围
min-port=49152
max-port=65535

# 安全：不允许中继到内网地址，防止被当成内网扫描跳板
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

fingerprint
```

```bash
sudo systemctl restart coturn
sudo systemctl status coturn
```

## 防火墙 / 安全组

必须放行（很多人卡在这一步）：

| 端口 | 协议 | 用途 |
|---|---|---|
| 3478 | TCP + UDP | TURN |
| 5349 | TCP + UDP | TURN over TLS |
| 49152-65535 | UDP | 媒体中继端口范围 |

⚠️ **TURN 不能走 Cloudflare Tunnel**——Tunnel 只代理 HTTP/WebSocket，TURN 需要
直接的 UDP。DNS 记录要设成 **DNS only（灰云）**，不能开橙云代理。

## 国内网络的两点提醒

1. **UDP 可能被干扰**：国内部分网络对 UDP 有限制。`turns:`（5349/TCP+TLS）作为
   兜底很重要，coturn 配置里两个都开着。
2. **服务器位置**：如果团队都在国内，TURN 放在境内或香港/日本延迟更低。境外
   服务器可能出现丢包和高延迟。

## 接进应用

构建网页时加上三个环境变量：

```bash
cd apps/android-client
VITE_RELAY_URL=wss://ws-next.secureinchat.com \
VITE_TURN_URL=turns:turn.secureinchat.com:5349 \
VITE_TURN_USERNAME=secureinchat \
VITE_TURN_CREDENTIAL=你设的强密码 \
npm run build
```

可选：`VITE_FORCE_RELAY=1` 强制所有媒体走 TURN（不向对端暴露自己的 IP，代价是
延迟和带宽全部由你承担）。

**没配 TURN 时**：应用照常能用，通话界面会如实显示「未配置 TURN 中继服务：
双方处于不同运营商网络时可能无法接通」，不会假装一定能打通。

## 怎么验证 TURN 真的生效

`packages/webrtc` 提供了 `probeIceServers()`——它真的建一个 RTCPeerConnection
收集一轮 ICE 候选，看能不能拿到 `relay` 类型的候选：

- 拿到 `relay` 候选 → TURN 配置正确，跨运营商能通
- 只有 `host` / `srflx` → TURN 没生效（地址错、凭证错、端口没放行），跨运营商
  大概率打不通

也可以用在线工具交叉验证：Google 的 WebRTC samples 里有一个 Trickle ICE 页面，
填入你的 TURN 地址和凭证，看能否出现 `relay` 候选。

## 已知限制

- **静态凭证**：上面用的 `lt-cred-mech` 静态用户名密码，对小团队试用够用，但
  凭证泄露后别人能白嫖你的带宽。生产应该改成基于时间的临时凭证
  （coturn 的 `use-auth-secret` + 服务端签发），这一块还没做。
- **媒体不是端到端加密**：WebRTC 的 DTLS-SRTP 保护的是传输段。用 TURN 时
  服务器转发的是加密包，理论上看不到内容，但这**不等于**端到端加密——真正的
  E2EE 通话需要帧级加密（SFrame），本项目还没实现。不要对外宣称通话是端到端
  加密的。
- **群通话**：只支持一对一。多人通话需要 SFU，未实现。
