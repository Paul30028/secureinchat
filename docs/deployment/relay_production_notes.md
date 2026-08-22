# SecureInChat WebSocket 中继技术文档

版本：V1.0\
项目：SecureInChat\
模块：Blind Relay WebSocket Relay\
状态：生产测试阶段

# 1. 模块定位

SecureInChat 使用盲中继（Blind Relay）架构。\
\
核心原则：\
- 服务端不解密消息\
- 服务端不保存聊天内容\
- 服务端只负责密文转发\
- 端到端加密发生在客户端

# 2. 当前生产节点

主中继：\
wss://ws.secureinchat.com\
\
用途：Android App、Web Client、测试客户端

# 3. 当前服务器架构

VPS：\
- WebSocket Relay 服务\
- Cloudflare Tunnel Connector\
\
内部服务：\
127.0.0.1:8765

# 4. Cloudflare Tunnel 配置

正确配置：\
Hostname: ws.secureinchat.com\
Service: http://127.0.0.1:8765\
\
禁止使用：secureinchat.com/ws

# 5. WebSocket 测试记录

命令：\
wscat -c wss://ws.secureinchat.com\
\
成功返回 auth_challenge 表示 DNS、TLS、Tunnel、WebSocket 均正常。

# 6. Cloudflare 故障记录

错误：530 / error code:1033\
原因：cloudflared 未运行。\
恢复：Active: active (running)，Registered tunnel connection。

# 7. 稳定性优化计划

已完成：\
✓ Cloudflare Tunnel\
✓ WSS\
✓ WebSocket Relay\
✓ 国内网络测试\
\
待完成：\
□ Android 自动重连\
□ 应用层心跳\
□ 消息确认机制\
□ 离线消息队列\
□ 多中继支持

# 8. 未来多中继架构

主节点：wss://ws.secureinchat.com\
备用节点：relay2、relay3\
\
客户端支持 fallback 自动切换。

# 9. 安全要求

服务器禁止：保存明文消息、聊天记录、用户关系。\
\
允许：临时连接状态、密文转发、网络统计。

# 10. 当前状态总结

已完成：\
✓ WSS连接\
✓ Cloudflare Tunnel\
✓ Blind Relay基础架构\
✓ 国内网络测试\
✓ 手机网络测试\
\
下一步：\
1. 自动重连\
2. 心跳机制\
3. Android Relay Manager\
4. 备用节点

---

*来源：Paul 提供的 `SecureInChat_WebSocket中继技术文档_V1_0.docx`，用 pandoc 转成 markdown 存档，
内容未改写。`server/relay` 的 `auth_challenge` 握手设计参考了这份文档第 2/5 节里已经在生产
验证过的模式，但 `server/relay` 本身是独立实现，不指向、不修改这里提到的生产节点
`wss://ws.secureinchat.com`。*
