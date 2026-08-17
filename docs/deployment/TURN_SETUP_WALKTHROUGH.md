# TURN 部署实操

> **状态：已部署并验证通过**（2026-08-16）
> `turn.secureinchat.com` → `212.135.212.22:3478`，DNS 灰云，coturn 运行中。
> 服务器本机 `turnutils_uclient` 测试：8 收 8 发、零丢包、抖动 0.25ms。
> 凭证已配进 APK 构建（见 `.github/workflows/build-apk.yml`）。
>
> **注意**：coturn 在 Ubuntu 上日志走 systemd journal，不写
> `/var/log/turnserver.log`。看日志用 `sudo journalctl -u coturn -f`。
>
> **排查经验**：在办公室/家庭宽带上用浏览器测 trickle-ice 可能一个候选都
> 收不到，而服务器本身完全正常——国内不少网络会阻断到 3478 的 UDP。
> 判断方法：点 Gather 时看 `journalctl -u coturn -f`，**日志里一条记录都没有**
> 就说明流量根本没到服务器，是路径问题不是配置问题。手机走 4G/5G 的路径
> 和电脑走 WiFi 完全不同，要以真机测试为准。

针对你的实际环境：VPS `212.135.212.22`，已经跑着两个中继（8765 生产、8766 本项目）
和 Cloudflare Tunnel、Caddy。

---

## 第 0 步：先说清楚一件事

**TURN 不能走 Cloudflare Tunnel**。Tunnel 只转发 HTTP/WebSocket，而 TURN 需要
直接的 UDP 端口。所以 `turn.secureinchat.com` 的 DNS 必须是**灰云（DNS only）**，
直接指向 `212.135.212.22`，不能开橙色代理。

这也意味着：**TURN 服务器的 IP 会暴露给通话双方**（这是 TURN 的工作方式，
不是配置问题）。你的服务器 IP 本来就不是秘密（旧中继也在上面），所以问题不大，
但值得知道。

---

## 第 1 步：DNS

Cloudflare 控制台 → DNS → 添加：

| 类型 | 名称 | 内容 | 代理状态 |
|---|---|---|---|
| A | `turn` | `212.135.212.22` | **DNS only（灰云）** |

⚠️ 一定要灰云。橙云的话 UDP 到不了你的服务器，TURN 直接不工作。

验证（在你的 Windows 上）：
```powershell
nslookup turn.secureinchat.com
```
应该返回 `212.135.212.22`。如果返回的是 Cloudflare 的 IP（104.x / 172.6x），
说明还是橙云，去关掉代理。

---

## 第 2 步：装 coturn

SSH 到 VPS，逐条执行：

```bash
sudo apt update
```
```bash
sudo apt install -y coturn
```

启用服务（Debian/Ubuntu 装完默认是禁用的）：
```bash
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
grep TURNSERVER_ENABLED /etc/default/coturn
```
应该看到 `TURNSERVER_ENABLED=1`。

---

## 第 3 步：生成一个密码

不要手打，让机器生成：
```bash
openssl rand -base64 24
```

**把输出抄下来**，下一步和客户端配置都要用。下面用 `你的TURN密码` 代指。

---

## 第 4 步：配置

先备份原配置：
```bash
sudo cp /etc/turnserver.conf /etc/turnserver.conf.bak
```

写入新配置（整段粘贴，注意把 `你的TURN密码` 换成上一步的输出）：

```bash
sudo tee /etc/turnserver.conf > /dev/null << 'EOF'
listening-port=3478

# 公网 IP。VPS 上 ifconfig 看到的可能是内网地址，所以必须显式写。
external-ip=212.135.212.22

realm=turn.secureinchat.com
server-name=turn.secureinchat.com

# 长期凭证。团队内部用，够了。
lt-cred-mech
user=secureinchat:你的TURN密码

# 中继端口范围。防火墙要放行这一整段 UDP。
min-port=49152
max-port=65535

# 不允许中继到内网地址 —— 否则你的 TURN 会变成别人扫描内网的跳板。
# 这条不能省。
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff

# 单个用户的并发配额，避免一个人把带宽吃光
user-quota=12
total-quota=1200

fingerprint
stale-nonce=600

# 日志：先开着，测通了再改成 syslog
log-file=/var/log/turnserver.log
verbose
EOF
```

替换密码（把 `你的TURN密码` 换成真实密码）：
```bash
sudo sed -i 's/你的TURN密码/这里粘贴第3步的输出/' /etc/turnserver.conf
sudo grep '^user=' /etc/turnserver.conf
```
确认输出里是真实密码，不是占位符。

---

## 第 5 步：防火墙

```bash
sudo ufw status
```

如果 ufw 是 active，放行：
```bash
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 49152:65535/udp
sudo ufw status | grep -E "3478|49152"
```

如果显示 `inactive`，说明没启用 ufw，跳过——但要确认 VPS 服务商的
控制台安全组也放行了这些端口（很多 VPS 有独立的云防火墙）。

---

## 第 6 步：启动

```bash
sudo systemctl restart coturn
sudo systemctl status coturn --no-pager | head -12
```

看到 `active (running)` 就对了。

确认端口在监听：
```bash
sudo ss -lnup | grep 3478
```

看日志有没有报错：
```bash
sudo tail -20 /var/log/turnserver.log
```

---

## 第 7 步：验证（关键一步，不要跳）

**在你的 Windows 上**用浏览器测，这是唯一能证明"从外网真的能用"的方法：

1. 打开 https://icetest.info/ （或搜 "webrtc trickle ice"）
2. 删掉默认的 STUN 条目
3. 添加：
   - STUN or TURN URI: `turn:turn.secureinchat.com:3478`
   - TURN username: `secureinchat`
   - TURN password: 你的密码
4. 点 "Gather candidates"

**期待结果**：列表里出现 `relay` 类型的候选（Component/Type 那一列写着 `relay`）。

- 有 `relay` → TURN 工作正常，可以继续
- 只有 `host` 和 `srflx`，没有 `relay` → TURN 没通，看下面的排查

### 排查

| 现象 | 检查 |
|---|---|
| 一个候选都没有 | DNS 没解析对，或 3478 端口没通 |
| 有 host/srflx 没有 relay | 认证失败（密码不对/realm 不匹配），看 `/var/log/turnserver.log` |
| 日志里 `401` 反复出现 | 用户名密码不匹配 |
| 日志里没有任何连接记录 | 防火墙挡住了，或 DNS 还指向 Cloudflare |

---

## 第 8 步：告诉我结果

把这三样发给我：
1. `sudo systemctl status coturn --no-pager | head -6`
2. `sudo ss -lnup | grep 3478`
3. icetest 有没有出现 `relay` 候选

**确认 TURN 通了之后**，我把凭证配进 APK 构建（`VITE_TURN_URL` /
`VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`），出一个带 TURN 的包，
你再用两台**不同运营商**的手机测通话。

---

## 关于凭证安全的一句实话

长期静态密码会被打进 APK，任何人反编译都能拿到，然后白嫖你的带宽做中继。

对内部小团队试用，这个风险可以接受（配了 `user-quota` 限制单用户并发）。
**如果以后要对外发布**，得换成时限凭证（TURN REST API）——服务端按时间生成
临时用户名密码，客户端启动时去取。那需要中继上加一个接口，不是现在该做的事。
