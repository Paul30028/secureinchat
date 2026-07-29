# 邀群密聊 Next — 架构总览

状态：草案 v0.1（第 4 步产出，随实现推进持续更新）
范围：第一阶段仅 Android（Capacitor），不含桌面端。

## 1. 与旧仓库的关系

本仓库（`secureinchat`）是 `Paul30028/secure-invite-chat` 的**独立重建**，不是 fork：

- 独立 git 历史、独立包名（`com.sic.invitechat.next`）、独立测试、独立 CI。
- 旧仓库仅作只读参考，本仓库不引用、不依赖、不提交回旧仓库。
- 旧仓库中**未通过安全评审的设计**（见 `docs/security/THREAT_MODEL.md` 附录 A「已知原型缺陷」）一律视为反面案例，不作为本仓库的默认实现，即使功能上"能跑"。

## 2. 模块划分

```
apps/android-client/    Capacitor 壳 + React UI 组装，只做装配和路由，不含业务逻辑
packages/ui/            纯展示层组件（设计系统：象牙白/麦穗金/鼠尾草绿/深墨绿）
packages/chat-core/     会话状态机：消息收发、去重、排序、已读回执、离线队列
packages/protocol/      SIC1（兼容）/ SIC2（正式）邀请串与线上消息格式的编解码
packages/crypto-core/   密钥管理、AEAD 加解密、epoch 轮换、Android Keystore 接口
packages/secure-storage/ 平台安全存储抽象（Android Keystore/EncryptedSharedPreferences），
                         明确禁止 localStorage 兜底
packages/webrtc/        通话信令状态机 + WebRTC 封装（STUN/TURN/SFU 客户端侧）
server/relay/           消息中继：只存转密文
server/signaling/       WebRTC 信令 + 在线状态
server/tests/           服务端协议/越权/重放测试
```

**依赖方向的硬规则**（对应你的原始要求"业务组件不能直接调用 localStorage、
WebSocket 或加密算法，必须通过接口层"）：

- `apps/android-client` 只能 import `packages/*` 的公开接口，不能直接 `fetch`/`WebSocket`/
  `crypto.subtle`/Capacitor 底层插件。
- `packages/chat-core` 通过 `packages/protocol` 收发消息，通过 `packages/crypto-core`
  加解密，通过 `packages/secure-storage` 落盘——本身不知道字节格式或密钥存在哪。
- 任何组件如果发现自己在直接 `localStorage.setItem`，视为架构违规，CI 的 lint 规则里会加
  对 `localStorage` 的全仓库禁用（`packages/secure-storage` 除非豁免，其余任何地方出现即报错）。

## 3. 协议双轨：SIC1 / SIC2

- `SIC1`：与旧中继/旧邀请串兼容，仅用于"旧成员迁移期"。UI 上任何 SIC1 会话必须显示
  "兼容模式"标记，且不得展示与 SIC2 相同的安全等级图标。
- `SIC2`：本项目的正式协议，字段设计见 `docs/protocol/SIC2_SPEC.md`（下一步产出）。
- 两种协议的编解码分别在 `packages/protocol/src/sic1/` 与 `packages/protocol/src/sic2/`
  独立目录，不共用状态，UI 组件里不出现 `if (isSIC1) ... else ...` 这类分支——而是由
  `packages/chat-core` 在会话建立时选定一个 `ProtocolAdapter` 实现。

## 4. 当前阶段的诚实状态

以下内容目前**只有接口和文档，没有完整实现**，不得在 UI 或文档中描述为"已完成"：

- MLS（群密钥的前向保密/后向保密）——现在只到"共享群密钥 + epoch 轮换"，MLS 是迁移目标。
- 文件分片加密——协议已设计（见 `docs/protocol/`），落地代码尚未开始。
- 音视频通话——信令状态机骨架待建，媒体层未接入真实 TURN/SFU。
- 正式发布签名、供应链校验——不在本仓库当前范围内，需你后续单独提供。

## 5. 变更记录

- v0.1：初始架构草案，建立目录骨架、crypto-core 与 protocol 包骨架。
