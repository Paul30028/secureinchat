# 邀群密聊 Next（secureinchat）

邀请制、端到端加密群聊的独立重建。参考（只读、不修改）：
[Paul30028/secure-invite-chat](https://github.com/Paul30028/secure-invite-chat)。

**当前状态以 [docs/PROJECT_HANDBOOK.md](docs/PROJECT_HANDBOOK.md) 第 6、7 节为准**(功能清单、测试数、已知缺口)。下面是摘要。

## 能用的

四个每日栏目、文字/图片/语音/文件、@提醒、回复/复制/删除/搜索、一对一语音视频通话、
多人语音会议(mesh,上限约 8 人)、多群、断线重连与离线补发、消息本地加密留存、应用锁、
连接诊断、群内设备列表、扫码加群、可截图分享的邀请卡片。

仓库结构:`apps/android-client`(React 19 + TypeScript + Vite + Capacitor 7)、
`packages/{ui,chat-core,crypto-core,protocol,secure-storage,webrtc}`、`server/relay`(Python websockets 中继)、`docs/`。
CI 跑 TS 矩阵、app 测试和构建、relay pytest、跨语言集成测试和 APK 构建。

## 已知缺口(不要说成做完了)

MLS 未实现(只有共享群密钥 + epoch 轮换);中继未启用成员资格校验;十几人视频会议未实现;
不能声称达到 Signal 级别。完整清单见手册第 7 节。

## 本地开发

```
cd packages/protocol && npm install && npm test
cd packages/crypto-core && npm install && npm test
```

各包的测试命令见手册;CI 配置在 `.github/workflows/ci.yml` 和 `build-apk.yml`。
