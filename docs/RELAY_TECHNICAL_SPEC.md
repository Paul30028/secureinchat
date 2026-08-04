# SecureInChat Next 中继服务技术文档

版本：V1.0
模块：`server/relay`
状态：试用部署中（`wss://ws-next.secureinchat.com`）

本文档描述的是**本仓库实现的中继**，与旧仓库 `secure-invite-chat` 的生产中继
（`wss://ws.secureinchat.com`）是两套不同协议的服务，互不兼容，可并行运行。
文中每一项能力都对应 `server/relay/tests/` 下的测试（共 96 项）。

---

## 1. 定位：盲中继

服务端**不知道**：
- 消息内容（只见密文，AES-256-GCM，密钥从不经过服务器）
- 文件名、文件类型、是图片还是语音（全在加密载荷内部）
- 群名、公告内容、发送者昵称（同上）
- 通话的 SDP/ICE 内容（只按 `targetDeviceId` 转发）

服务端**知道**（不可避免的元数据）：
- 谁（deviceId）在哪个群（groupId）在线
- 谁给谁发了消息、密文多大、什么时候

服务端**不做**：
- 保存任何聊天内容（进程内存态，重启即清空）
- 生成或持有任何用户密钥

---

## 2. 技术栈

| 项 | 选择 |
|---|---|
| 语言 | Python 3.12 |
| WebSocket | `websockets` 17.0 |
| 密码学 | `cryptography` 49.0（仅用于验证客户端签名） |
| 进程管理 | systemd |
| TLS / 公网接入 | Cloudflare Tunnel |
| 状态 | 全内存，无数据库 |

---

## 3. 连接与认证

### 3.1 握手时序

```
客户端                                    服务端
   |                                        |
   |------------ WebSocket 连接 ----------->|
   |                                        |
   |<---- {"type":"auth_challenge",         |
   |        "nonce":"<base64url 随机数>"}   |
   |                                        |
   |----- register_device 或 --------------->|
   |      auth_response 或                  |
   |      rotate_device_key                 |
   |                                        |
   |<---- {"type":"auth_ok"}                |  ← 身份+成员资格都通过才发
   |<---- {"type":"presence",               |
   |        "deviceIds":[...]}              |
   |                                        |
```

> **注意**：字段是 `nonce` 而非 `challenge`。旧生产中继用的是 `challenge`，
> 这是两套协议最直接的区分点，`scripts/probe-relay-protocol.py` 据此判别。

### 3.2 三种认证帧

**`register_device`** — 首次注册（TOFU，Trust-On-First-Use）
```json
{"type":"register_device","deviceId":"...","groupId":"...",
 "publicKeyRawB64Url":"<未压缩点 P-256 公钥>","proof":"<对 nonce 的签名>"}
```
服务端校验 `proof` 确实由 `publicKeyRawB64Url` 对应的私钥签出（自证持有），
且该 `deviceId` **尚未注册过**。已注册的一律拒绝——否则任何人都能用别人的
deviceId 塞一把自己的公钥进去，等于身份劫持。

**`auth_response`** — 已注册设备的日常认证
```json
{"type":"auth_response","deviceId":"...","groupId":"...","proof":"..."}
```

**`rotate_device_key`** — 密钥轮换
```json
{"type":"rotate_device_key","deviceId":"...","groupId":"...",
 "newPublicKeyRawB64Url":"...","oldKeyProof":"...","newKeyProof":"..."}
```
要求**同时**证明持有旧私钥（你就是当前登记的设备）和新私钥（不是随手指定
一个不属于自己的公钥）。任一失败则整体拒绝，注册表保持不变。

### 3.3 签名格式（跨语言易踩坑处）

- 公钥：未压缩点格式，65 字节，首字节 `0x04`（Web Crypto `exportKey("raw")` 的输出）
- 签名：Web Crypto 输出的是 **IEEE P1363**（r‖s，各 32 字节），
  Python 的 `cryptography` 需要 **DER**，服务端负责转换
- 算法：ECDSA P-256 + SHA-256，签名对象是 `nonce` 的 UTF-8 字节

这一段有专门的跨语言测试：用真实 `crypto-core` 的 `KeystorePort` 生成 fixture，
验证 TS 端签的名 Python 端能验过（`test_pubkey_auth.py`）。

---

## 4. 消息转发

```json
→ {"type":"forward","ciphertextB64":"<不透明字节>"}
← {"type":"forward","fromDeviceId":"<发送者>","ciphertextB64":"<原样透传>"}
```

广播给同群其他所有在线成员，**不回给发送者自己**。服务端只判断
`ciphertextB64` 字段是否存在，不解码、不检查内容结构。

文本、图片、语音、文件分片、公告**全部走这一个帧**——消息类型放在加密载荷
内部的信封里（`kind: "text" | "announcement" | "file-meta" | "file-chunk"`），
所以新增消息类型不需要改服务端一行代码。

---

## 5. 在线状态

| 帧 | 方向 | 时机 |
|---|---|---|
| `{"type":"presence","deviceIds":[...]}` | 服务端→新加入者 | 认证成功后立即 |
| `{"type":"peer_joined","deviceId":"..."}` | 服务端→群内其他人 | 有人上线 |
| `{"type":"peer_left","deviceId":"..."}` | 服务端→群内其他人 | 有人下线 |

**实现细节**：在线名单是在把新连接注册进房间**之前**取的，否则新人会在自己
收到的名单里看到自己。在线状态严格按群隔离，别的群的人既不出现在名单里，
也收不到事件。

---

## 6. 通话信令

7 种帧，按 `targetDeviceId` **精确路由**给同群的那一个人（不是广播）：

```
call_invite / call_ring / call_answer / call_reject
call_cancel / call_hangup / ice_candidate
```

转发时原样透传所有字段并加上 `fromDeviceId`。SDP 和 ICE candidate 的内容
服务端不解析。

目标不在线、或不在同一个群（即使那个设备本身在线）——**两种情况回同一个错误**：
```json
{"type":"call_failed","callId":"...","reason":"target_offline"}
```
故意不区分，防止拿信令当"探测某个 deviceId 是否存在于别的群"的工具。

---

## 7. 心跳与保活

**协议层**（`websockets` 库自动处理）：
```python
ping_interval=20   # 秒
ping_timeout=60
```
用于防 NAT 超时、移动网络断开、Cloudflare 空闲关闭。

**应用层**：
```json
→ {"type":"ping","timestamp":1721910000000}
← {"type":"pong","timestamp":1721910000000}
```
原样回带 `timestamp`，客户端据此计算真实的消息往返延迟（RTT）。
两层都要有：协议层保活连接，应用层测量延迟并发现"TCP 还在但对端已不处理消息"
的半开连接。心跳是点对点回的，不会扇出给整个群。

---

## 8. 客户端重连策略

由 `packages/chat-core` 的 `RelayClient` 实现：

| 尝试次数 | 等待 |
|---|---|
| 1 | 3 秒 |
| 2 | 5 秒 |
| 3 | 10 秒 |
| 4 | 20 秒 |
| 5+ | 30 秒（封顶） |

- 连接+认证整体超时 **10 秒**，超时报「连接超时——请检查服务器地址是否正确、
  服务是否已启动」，而不是一直转圈
- 重连优先 `authenticate`，失败退回 `register`（服务端注册表是内存态，
  重启后不认识老设备）
- 断线期间发的消息进本地队列，重连后**按原顺序**补发，已发出的不重复发
- 主动 `close()` 则停止一切定时器，不再重连

---

## 9. 部署

```
ws.secureinchat.com       →  127.0.0.1:8765   旧中继（生产，不动）
ws-next.secureinchat.com  →  127.0.0.1:8766   本中继
```

同一台 VPS 并行运行，各自独立的 systemd 服务
（`secureinchat-next.service`），Cloudflare Tunnel 各配一条 hostname。

启动：
```bash
SECUREINCHAT_RELAY_PORT=8766 ./.venv/bin/python main.py
```
输出 `READY` 表示就绪。`curl -i http://127.0.0.1:8766` 应返回
`426 Upgrade Required`（正常，说明在等 WebSocket upgrade）。

详见 `DEPLOY_NEXT_RELAY_ALONGSIDE.md`。

---

## 10. 安全边界

**已实现**：
- 设备身份基于 ECDSA P-256，服务端只存公钥，永不接触私钥
- TOFU 注册防止 deviceId 抢注
- 密钥轮换要求新旧双重证明
- 成员资格校验（`GroupMembership`）与邀请码校验（`InviteRegistry`）代码完备
- 消息重放检测在客户端（`ReplayGuard`，按 senderId+epoch+seq）

**当前部署的已知放宽**（`main.py` 未启用，试用期取舍）：
- **没有启用成员资格校验**：任何设备走完握手，claim 哪个 groupId 就能进哪个群。
  小范围可信团队可接受，**不要公开这个地址**
- **没有限流**：地址泄露会被白嫖带宽
- **设备注册表内存态**：重启后所有设备需重连（客户端自动处理）

**架构上不做的**：
- 不保存消息（所以没有服务端离线暂存、换设备看不到历史）
- 不做端到端加密的媒体中继（通话媒体走 WebRTC，不经过本服务）

---

## 11. 测试覆盖

96 项，`server/relay/tests/`：

| 文件 | 覆盖 |
|---|---|
| `test_registry.py` | 房间注册表、精确查找、跨群隔离 |
| `test_auth.py` | 挑战生成、HMAC 桩验证 |
| `test_pubkey_auth.py` | ECDSA 验签、**跨语言互操作**、篡改/错误公钥 |
| `test_register_device.py` | TOFU 注册、**防身份抢注** |
| `test_rotate_device_key.py` | 双重证明轮换、旧密钥失效 |
| `test_membership.py` / `test_membership_gate.py` | 成员资格关卡 |
| `test_invite_registry.py` / `test_invite_join.py` | 邀请码校验/消耗/过期/次数 |
| `test_presence.py` | 在线名单、上下线广播、跨群隔离 |
| `test_call_signaling.py` | 7 种信令帧路由、跨群隔离、内容不被解析 |
| `test_heartbeat.py` | ping/pong、timestamp 回带、不广播 |
| `test_integration.py` | 真实 WebSocket 端到端 |

另有 `packages/chat-core/test/relayClient.integration.test.ts`：真的拉起本服务
子进程，TS 客户端连上去完成完整加密收发——跨进程、跨语言的端到端验证。

---

最后更新：2026-08-04
