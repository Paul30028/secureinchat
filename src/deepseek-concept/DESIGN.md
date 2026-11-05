# SecureInChat 概念稿 · 设计说明

## 1. 设计理念

目标：让 SecureInChat 看起来像一家**可靠的一流科技公司**，而不是一个"工具收藏夹"。
核心策略是 **"深空暗色 + 发光青绿 + 玻璃质感 + 精密的代码化线条插图"**，把"隐私"这件事从"焦虑"翻译成"掌控"。

三条设计原则贯穿全站：

1. **一眼看懂**——首页第一屏只有一句话和一个主按钮："See what you give away. Then switch it off." 以及 "Start the privacy checkup"。
2. **诚实即信任**——黄色警示条、清晰的"in development / no audit"标签、"Local processing / Network lookup / Limited lookup"三色标签，让读者第一眼看到的是"这个团队说真话"，而不是营销辞令。
3. **视觉分层**——每个页面都用同一套"信息层"：氛围网格背景 → 吸顶玻璃导航 → 主视觉（发光 SVG 插图）→ 内容卡片 → 收束 CTA → 页脚。

## 2. 配色

| 角色 | 颜色 | 用途 |
|---|---|---|
| 背景 | `#070b12` / `#060910` | 深空底色，营造纵深 |
| 表面 | `#0b1220` / `#101a2e` | 卡片、面板 |
| 主强调 | `#3ef0c2`（青绿） | 本地工具、成功、主按钮、hero 高光 |
| 次强调 | `#48a6ff`（电蓝） | 网络工具、连接、数据流 |
| 第三强调 | `#9b7bff`（紫罗兰） | Messaging、邀请/密钥、威胁模型 |
| 警示 | `#ffb547`（琥珀） | 限制、limited lookup、in development |
| 危险 | `#ff6b7a`（珊瑚） | 失败状态（诊断） |
| 正文 | `#eaf1fb` | 高对比白 |
| 次文 | `#a9b8d0` | 说明文字 |
| 弱文 | `#6f809c` | 元信息、标注 |

**三色强调的分工是刻意的**：青绿 = 你能掌控的（本地）、电蓝 = 需要联网的（外部）、紫罗兰 = 未来的（Messaging）。颜色的含义在三个页面都是稳定的。

**背景**：固定定位的 `.grid-bg`，叠加三层径向渐变（右上主色、左上辅色、底部辉光）和一层 64px 网格（带径向 mask），给暗色页面"深空"与"仪表盘"两种气质。

## 3. 字体

- 正文与标题：系统无衬线字族 **Inter → Segoe UI → system-ui**，避免加载第三方字体，保证隐私（不向 Google Fonts 发请求）。
- 数字、代码、标签、状态：**等宽字族**（SFMono / ui-monospace / Menlo…）。所有 `badge`、`status chip`、`data-flow`、`relay diagnostic` 面板的数字都用等宽字体，强化"这是可验证的技术信息"的观感。
- 大小层级：`clamp()` 全站响应式。H1 最大 64px，正文 18–18.5px，说明文字 14–15px，标签 10–12.5px。

## 4. 插图风格

全部用 **内联 SVG** 绘制，共 5 张插图，风格统一：

- **发光描边 + 深浅渐变**：`linearGradient`（青绿→电蓝→紫罗兰）配合 `feGaussianBlur` 柔光滤镜，让线条有"光在流动"的感觉。
- **精密线稿**：轨道环、网格、刻度、虚线路径、`ui-monospace` 标注的小 chip（如"GPS removed"、"0 requests sent"、"BLIND RELAY"）。
- **主题化**：
  - 首页 hero：**盾牌 + 数据流线 + 手机构成的锁**——把"保护"变成可视化的"数据被盾牌包裹"。
  - 首页 messaging teaser：**四台设备围绕一个中继节点**——直观展示"设备握钥匙，中继只转发"。
  - Messaging hero：**两台设备 / 盲中继 / 虚线密文路径**。
  - Messaging 3 步流程：**CSS 卡片 + 连接箭头 + 密文条带**（plaintext → AES-256-GCM → relay → decrypt）。
  - Tools hero：**轨道上的六个工具 chip 围绕中心盾牌**——把"工具集合"可视化成"围绕保护运转的卫星"。
  - Tools checkup banner：**报告卡片**（12 个勾选、彩点区分数据类型）。
  - Messaging 邀请码 callout：**QR 样式的密钥方块**。

所有装饰性 SVG 都带 `aria-hidden="true"`，有语义的带 `<title>` 或 `aria-label`，插图不影响可访问性。

## 5. 动效

- **滚动渐显**：`.reveal` + `IntersectionObserver`，位移 20–22px + 透明度 0→1，时长 0.7s；`prefers-reduced-motion` 时全部关闭。
- **卡片指针光晕**：工具卡片跟随鼠标水平位置更新 `--mx`，导致径向高光移动，纯 CSS 响应，无 JS 动画循环。
- **按钮/箭头**：hover 时主按钮上浮 1px，箭头 `translateX(4px)`。
- **Live relay diagnostic**：点击后从 0→10%→70%→100% 的进度条，配合真实 WebSocket 事件驱动状态；有 8s 超时保底，失败时诚实显示 "Unreachable / failed"，不伪装成功。

## 6. 三个页面各自的重点

- **首页**：一句话首屏 → 本地工具 6 卡 → 数据流证明面板 → 限制警告条 → Messaging teaser → 面向普通人的指南区 → 收束 CTA。
- **Messaging**：状态横幅（在开发 / 无审计）→ 主视觉 → **Live relay diagnostic**（真实 WebSocket，无内容）→ 三步设备边缘流程 → 完整威胁模型（保护 vs 抵抗 vs 副作用 vs 免责）→ 密码学构建块 → CTA。
- **Tools**：工具英雄 → **Privacy checkup banner**（12 项 / 含网络查找）→ 连接类工具（4 卡）→ 日常工具（8 卡）→ **数据流三种标签** 图例 → 收束 CTA。

## 7. 如何推广到网站其他页面

因为三个页面共享同一套"组件语法"，扩展到 Guides、单个工具页、About、Privacy、Contact 都很简单：

1. **复用 `<style>` 里的 block**（每页自包含，但内容一致）：
   - `.grid-bg` / `.topbar` / `header.site` / `.wrap` / `.btn` / `footer.site`。
2. **新增页面即复制头部 + 页脚**，中间换成：
   - **Guides 列表页**：直接复用 `.tool-grid` + `.tool`（把"Open tool"换成"Read guide"）。
   - **单个工具页**：左栏 `tool-grid` 单卡样式 + 右栏"Requests from this page"面板（复用首页 `.proof .req-log`）。
   - **About / Mission**：复用 `.panel` + `.limits-list` + `.cta-strip`。
3. **新工具接入**：只需填三样——`icon`、`title`、`label`（local / network / limited），卡片自动继承视觉体系。
4. **新增语言**：`.lang` 已预留中/日切换位置，将来接入 i18n 时只需给页面加 `lang` 变体。
5. **配色扩展**：危险红只用于"失败/风险"，警示琥珀只用于"限制/开发中"，新颜色出现前先确认不破坏"三色分工"。

## 8. 内容诚实性核对清单

为保证"内容必须真实"，以下事实点都从原始内容或威胁模型中**原样保留**，不做美化：

- 聊天 App **in development**、**no release date**、**no independent audit**。
- 中继目前由 **Cloudflare** 前置；网络地址只保留 **加盐哈希**（salted hash）。
- 群密钥通过**邀请码**传递；成员之间**没有公钥交换**。
- 群名**只在本设备**，从不发给中继。
- 管理员公告带**ECDSA P-256 签名**；客户端拒绝无法验证的公告。
- **没有前向保密**（同一周期内所有消息共用群密钥）。
- **被移除成员仍保留历史消息**；**丢失管理员签名密钥需要恢复步骤**。
- 与 Signal / MLS 相比，移除时的密钥轮换**更弱**；**不宣称等同安全**。
- **Limited lookup** 只发送 SHA-1 前 5 字符；**Network lookup** 会把 IP/URL 发给第三方。
- **Live relay diagnostic** 只检查：网络连接 / 握手时间 / relay challenge；**不是安全审计**。
- 所有"清楚说明限制"的文案（Privacy-conscious by design. Clear about limitations.）保留。
