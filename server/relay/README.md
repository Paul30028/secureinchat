# server/relay

盲中继 WebSocket 服务端：认证握手 + 密文转发。协议契约见
`docs/protocol/RELAY_CONTRACT_V0.md`。

**这不是生产部署**。参考了 `docs/deployment/relay_production_notes.md`（你提供的
生产运维文档）里已经验证过的 `auth_challenge` 握手模式，但：

- 设备验证目前是 `PlaceholderHmacVerifier`（共享密钥 HMAC），真实方案要接
  Android 端 Keystore 签名验证
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

17 个测试：6 个房间注册表单元测试、6 个认证桩单元测试、5 个真实起本地服务器 +
真实 WebSocket 客户端的集成测试（握手成功/失败、密文原样转发、跨群隔离、断连清理）。
