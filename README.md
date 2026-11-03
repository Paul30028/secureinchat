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

## 本机数据保护(C10-A)

Android 上，加密本机群密钥和消息的主密钥由 Android Keystore 里的硬件密钥包裹(有 StrongBox 安全芯片就用它，否则用手机的安全硬件 TEE)，落盘的只有包裹后的字节。「我的」页显示这台手机实际用的是哪一级。

- **防**：拷走应用数据目录(包括系统备份恢复到别的手机)后离线解密。
- **不防**：在已解锁的手机上，以本应用身份运行的程序(例如手机被 root 后)直接请系统解包。M1 没有绑定系统认证;捡到已解锁手机、不知道应用锁 PIN 也读不出，是下一阶段(方案 C)的目标。
- 应用锁 PIN 仍然只管「能不能打开界面」，不参与加密。
- 网页版和系统密钥库不可用的设备没有硬件保护(加密密钥存在本机存储里)，界面如实写明。
- 设备签名密钥还没有硬件化(后续里程碑)。
- 硬件密钥丢失(清除数据、重装后数据又被恢复回来等)时，本机数据无法解开：应用会单独一屏说明，用户确认后清空本机加密数据，再从备份恢复。
- 从旧版本升级：旧主密钥保留到后台把所有条目改写完成才删除;中途断电不丢数据(每个条目要么是旧密钥、要么是新密钥加密，两种都读得出)。

## 已知缺口(不要说成做完了)

MLS 未实现(只有共享群密钥 + epoch 轮换);中继未启用成员资格校验;十几人视频会议未实现;
不能声称达到 Signal 级别。完整清单见手册第 7 节。

## 本地开发

```
cd packages/protocol && npm install && npm test
cd packages/crypto-core && npm install && npm test
```

各包的测试命令见手册;CI 配置在 `.github/workflows/ci.yml` 和 `build-apk.yml`。
