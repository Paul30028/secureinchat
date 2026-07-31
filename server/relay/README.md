# server/relay

盲中继 WebSocket 服务端：认证握手 + 密文转发。协议契约见
`docs/protocol/RELAY_CONTRACT_V0.md`。

**这不是生产部署**。参考了 `docs/deployment/relay_production_notes.md`（你提供的
生产运维文档）里已经验证过的 `auth_challenge` 握手模式，但：

- 设备验证有两个实现：
  - `PlaceholderHmacVerifier`（共享密钥 HMAC）——仅用于本地快速联调
  - `PublicKeyDeviceVerifier`（ECDSA P-256 + SHA-256，验证 Android/Web Crypto
    Keystore 签的名）——真实方向。配合 `DeviceRegistry` 的 `register_device`
    TOFU 首次注册 + `rotate_device_key` 密钥轮换（要求新旧私钥双重证明），
    `main.py` 默认用的就是这一套
- `GroupMembership` 已接入连接流程：传了就真的校验成员资格，不传则跳过（默认）
- `InviteRegistry` 已实现但**未接入**——没有对应的"用邀请码加群"帧，是下一个切片
- 没有限流、没有多中继 fallback、没有监控
- 不会、也不应该指向 `wss://ws.secureinchat.com`——那是现有生产节点，本仓库的
  第十四节约束里明确"未经批准不得替换当前生产服务器"

## 本地跑

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python main.py
```

## 测试

```bash
./.venv/bin/python -m pytest tests/ -v
```

83 个测试：房间注册表、HMAC 认证桩、真实 WebSocket 集成测试、`PublicKeyDeviceVerifier`
跨语言互操作测试、`register_device` TOFU 注册（含防冒充攻击测试）、
`rotate_device_key` 密钥轮换（新旧密钥双重证明、拒绝未注册设备轮换等 7 个场景）、
`GroupMembership` 单测 + 通过真实连接验证的成员资格关卡（含"不配置 membership 就
完全跳过检查"的向后兼容测试）、`InviteRegistry` 单测 + 邀请码加群集成测试（7 个场景，
含过期/次数用尽/向后兼容）、WebRTC 一对一信令路由（`call_invite`/`call_answer`/
`ice_candidate` 等 7 种帧类型全覆盖，含跨群隔离和 SDP/ICE 内容不被解析的验证）。
