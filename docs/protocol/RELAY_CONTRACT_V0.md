# Relay 线上协议契约 v0.1

范围仅覆盖本次切片：连接注册 + 认证握手 + 密文转发。限流、多中继、真实设备签名验证
不在这份契约里（见 `docs/architecture/ARCHITECTURE.md` 的"尚未开始"清单）。

## 帧格式

所有帧都是 JSON 文本帧（不是二进制），字段：

```
{"type": "<帧类型>", ...}
```

## 握手（对应技术文档里已验证的 auth_challenge 模式）

1. 客户端建立 WebSocket 连接。
2. 服务端立即下发：
   ```json
   {"type": "auth_challenge", "nonce": "<base64url 随机数>"}
   ```
3. 客户端回复以下几种帧之一（`auth_response` / `register_device` / `rotate_device_key`
   都可以额外带一个可选的 `inviteCode` 字段——只有在设备还不是这个 `groupId` 的成员
   时才会用到，已经是成员的话这个字段被忽略）：

   **a) `register_device`（首次见面，TOFU 注册）**——deviceId 还没注册过时用这个：
   ```json
   {"type": "register_device", "deviceId": "...", "groupId": "...",
    "publicKeyRawB64Url": "<未压缩点格式公钥>", "proof": "<对 nonce 的签名>"}
   ```
   服务端校验 `proof` 确实是用 `publicKeyRawB64Url` 对应的私钥签的（自证持有），
   且 `deviceId` **尚未注册过**——已注册的 deviceId 一律拒绝，不允许用这个帧
   覆盖已有公钥（防止身份冒充/密钥劫持）。通过则登记进 `DeviceRegistry` 并视为
   认证成功。

   **b) `auth_response`（已注册设备的日常认证）**：
   ```json
   {"type": "auth_response", "deviceId": "...", "groupId": "...", "proof": "..."}
   ```
4. 服务端用可替换的 `DeviceVerifier` 校验 `proof`：
   - 校验失败 → `{"type": "auth_failed", "reason": "..."}`，随后服务端主动断开连接
   - 校验通过但配置了成员资格检查（`membership` 传了 `GroupMembership` 实例）且该
     设备不是 `groupId` 的成员 → 同样 `auth_failed`，reason 为
     `"not a member of this group"`。**`auth_ok` 只有在身份证明和成员资格都通过后
     才发送**——早期实现里 `auth_ok` 在身份证明通过后立刻发送，成员资格检查是后
     加的第二道关卡，导致客户端在关卡生效前就已经收到了 `auth_ok`（这是一个真实
     发现并修复的时序 bug，不是设计如此）。
   - 都通过 → `{"type": "auth_ok"}`，连接被登记进 `groupId` 对应的房间
5. 握手完成前，服务端拒绝处理任何其他类型的帧。

## 成员资格（membership）与邀请码校验（invite_registry）

- `GroupMembership`：接入 `handle_connection`，如果构造 `RelayServer` 时传了
  `membership` 实例，未加入群的设备连接会被拒绝。不传（默认）则完全跳过这层检查，
  向后兼容。
- `InviteRegistry`：**已接入**——设备通过成员资格检查失败、且帧里带了 `inviteCode`、
  且配置了 `invite_registry` 时，服务端会尝试校验并消耗这个邀请码；成功则调用
  `membership.add()` 授予成员资格并放行，失败则 `auth_failed`（reason 形如
  `"invalid invite: expired"`）。已经是成员的设备不需要、也不会用到 `inviteCode`。
  邀请码本身怎么生成、管理员怎么分发不在这份契约里——那是第十三节的管理员功能。

`DeviceVerifier` 是一个协议接口，有两个实现：
- `PlaceholderHmacVerifier`——仅供本地测试/联调，共享密钥 HMAC，proof 是
  base64url(HMAC-SHA256(sharedSecret, "deviceId:nonce"))
- `PublicKeyDeviceVerifier`——真实方向，proof 是 base64url(ECDSA-P256-SHA256
  签名)，签名用客户端 Keystore 私钥对 `nonce` 的 UTF-8 字节签出（Web Crypto
  的 P1363 格式，服务端转成 DER 再验证），公钥来自 `DeviceRegistry`

公钥怎么注册进 `DeviceRegistry`（邀请环节的登记流程）还没做，是后续切片，不在这份
契约里冒充已经完成。

## 密文转发（盲中继核心）

握手完成后，客户端可以发送：

```json
{"type": "forward", "ciphertextB64": "<base64，服务端不解析、不解密>"}
```

服务端把这一帧原样转发给同一个 `groupId` 房间里除发送者以外的所有已认证连接：

```json
{"type": "forward", "fromDeviceId": "<发送者 deviceId>", "ciphertextB64": "<原样透传>"}
```

服务端**只**读取 `ciphertextB64` 字段的存在性用于转发，不解码、不检查其内容结构——这是
"盲中继"的核心约束：`ciphertextB64` 字段名故意提醒实现者"这是不透明字节，不是要理解的
数据"。

## 断连

任一连接关闭时，服务端把它从房间注册表里移除。房间是纯内存结构，进程重启即清空——
符合"服务端不持久化聊天相关状态"的要求。

## 非目标（明确不在这份契约里）

- 限流 / 防滥用
- 多中继 fallback（relay2/relay3）
- 真实设备签名验证（现在是可替换的测试桩）
- 消息确认机制、离线消息队列（这些在 `chat-core` 的 `OfflineOutbox` 里已经有客户端侧的部分，
  服务端侧的持久暂存属于后续切片）
