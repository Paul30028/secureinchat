# server/relay

盲中继 WebSocket 服务端：认证握手 + 密文转发。协议契约见
`docs/protocol/RELAY_CONTRACT_V0.md`。

**这不是生产部署**。参考了 `docs/deployment/relay_production_notes.md`（你提供的
生产运维文档）里已经验证过的 `auth_challenge` 握手模式，但：

- 设备验证有两个实现：
  - `PlaceholderHmacVerifier`（共享密钥 HMAC）——仅用于本地快速联调
  - `PublicKeyDeviceVerifier`（ECDSA P-256 + SHA-256，验证 Android/Web Crypto
    Keystore 签的名）——这是真实方向，但公钥怎么注册进 `DeviceRegistry`（邀请
    环节的登记流程）还没做，属于后续切片
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

30 个测试：房间注册表、HMAC 认证桩、真实 WebSocket 集成测试（握手/密文转发/跨群
隔离/断连清理），以及 `PublicKeyDeviceVerifier` 的跨语言互操作测试——用
`scripts/gen-relay-auth-fixture.mjs` 生成的、由 crypto-core 真实 `KeystorePort`
签名的 fixture，证明 TS 端 Web Crypto 签名格式（P1363）转成 DER 后，Python 的
`cryptography` 库能正确验证，外加篡改签名/错误公钥/畸形数据等攻击场景。
