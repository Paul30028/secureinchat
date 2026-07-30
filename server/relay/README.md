# server/relay

盲中继 WebSocket 服务端：认证握手 + 密文转发。协议契约见
`docs/protocol/RELAY_CONTRACT_V0.md`。

**这不是生产部署**。参考了 `docs/deployment/relay_production_notes.md`（你提供的
生产运维文档）里已经验证过的 `auth_challenge` 握手模式，但：

- 设备验证有两个实现：
  - `PlaceholderHmacVerifier`（共享密钥 HMAC）——仅用于本地快速联调
  - `PublicKeyDeviceVerifier`（ECDSA P-256 + SHA-256，验证 Android/Web Crypto
    Keystore 签的名）——真实方向。配合 `DeviceRegistry` 的 `register_device`
    TOFU 首次注册流程，`main.py` 默认用的就是这一套
- 已知限制：已注册设备**换公钥**（密钥轮换）还没做——`register_device` 明确拒绝
  覆盖已注册的 deviceId，防冒充，但这也意味着真丢了私钥目前没有恢复路径，是下一个
  切片
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

35 个测试：房间注册表、HMAC 认证桩、真实 WebSocket 集成测试（握手/密文转发/跨群
隔离/断连清理）、`PublicKeyDeviceVerifier` 的跨语言互操作测试（用
`scripts/gen-relay-auth-fixture.mjs` 生成的、由 crypto-core 真实 `KeystorePort`
签名的 fixture），以及 `register_device` TOFU 注册流程的测试——包括最关键的一项：
攻击者不能用自己的私钥抢注别人已经注册过的 deviceId。
