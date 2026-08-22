# 邀群密聊 Next（secureinchat）

邀请制、端到端加密群聊的独立重建。参考（只读、不修改）：
[Paul30028/secure-invite-chat](https://github.com/Paul30028/secure-invite-chat)。

**当前阶段：早期骨架。以下内容是真实存在、有测试覆盖的；未列出的一律视为未开始。**

## 已完成并通过测试

- `packages/protocol`：SIC1（兼容旧协议）/ SIC2（正式协议）邀请串编解码，
  13 个单元测试全部通过（过期、次数用尽、篡改、未知前缀等边界情况）。
- `packages/crypto-core`：
  - AES-256-GCM AEAD 封装（含 AAD 上下文绑定、篡改检测、错误密钥检测）
  - 基于 HKDF 的群 epoch 密钥派生 + 文件密钥派生
  - 群 epoch 轮换管理器（`InMemoryGroupEpochManager`），并有测试证明
    "成员移除触发轮换后，旧 epoch 密钥无法解密新消息"
  - `KeystorePort` 接口 + 仅供测试的内存实现（明确标注不可用于生产）
  - 16 个单元测试全部通过
- `docs/architecture/ARCHITECTURE.md`、`docs/security/THREAT_MODEL.md`：
  架构总览与威胁模型草案，包含对旧仓库已知缺陷的如实清单。

## 尚未开始

`packages/ui`、`chat-core`、`secure-storage`、`webrtc`，`apps/android-client`，
`server/*`，以及第八节列出的全部 39 个界面/状态、音视频通话、管理员功能、
自动化测试的其余部分、GitHub Actions 的其余工作流、APK 构建。

## 本地开发

```
cd packages/protocol && npm install && npm test
cd packages/crypto-core && npm install && npm test
```

目前仓库还没有根级 lockfile，CI 尚未在真实 GitHub Actions 环境跑过
(`.github/workflows/ci.yml` 已写好，覆盖 typecheck + test，尚待首次推送后验证)。
