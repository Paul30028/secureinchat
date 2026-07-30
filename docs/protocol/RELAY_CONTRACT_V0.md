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
3. 客户端回复：
   ```json
   {"type": "auth_response", "deviceId": "<设备id>", "groupId": "<群id>", "proof": "<对 nonce 的证明>"}
   ```
4. 服务端用可替换的 `DeviceVerifier` 校验 `proof`：
   - 通过 → `{"type": "auth_ok"}`，连接被登记进 `groupId` 对应的房间
   - 失败 → `{"type": "auth_failed", "reason": "..."}`，随后服务端主动断开连接
5. 握手完成前，服务端拒绝处理任何非 `auth_response` 帧。

`DeviceVerifier` 是一个协议接口，本切片只提供一个**仅供测试**的实现（HMAC 校验一个共享
测试密钥），真实实现要接 Android 端 Keystore 签名验证，属于后续切片，不在这里冒充。

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
