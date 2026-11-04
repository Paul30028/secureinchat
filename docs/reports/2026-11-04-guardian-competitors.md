# Guardian 与 GitHub 同类项目对比 + 怎样领先(Claude Code,2026-11-04)

Paul 的问题:GitHub 上有没有同类软件?要在技术先进性和解决用户痛点上领先。下面的数字和功能都来自 GitHub API(2026-11-04 查询)和各项目自己的 README;用户痛点来自各项目 issue 的点赞数和关键词计数。项目经理那边在 claude.ai 项目里有 `docs/github-teardown-2026-10-31.md` 和 `docs/guardian-advancement-research-2026-11-01.md`,请和这份对照，有冲突以核对过原文的为准。

## 一、同类项目(都是安卓、都用本机 VPN 接口)

| 项目 | Star | 最近提交 | 许可证 | 做法 | 关键能力(出自 README) |
|---|---|---|---|---|---|
| [celzero/rethink-app](https://github.com/celzero/rethink-app) | 5840 | 2026-10-26 | Apache-2.0 | 全部流量进本机隧道 | DoH、ODoH、DoT、DNSCrypt;按 App 的防火墙(按亮屏/前后台/计费网络);多跳 WireGuard;按 App 的连接记录。Play 版的拦截名单在云端("on-device blocklists aren't possible" on Play) |
| [TrackerControl](https://github.com/TrackerControl/tracker-control-android) | 2719 | 2026-11-02 | GPL-3.0 | 本机过滤，可选转发到 Mullvad/IVPN/WireGuard | 按 App、按追踪者控制;**已有 App 内追踪库分析(Exodus 签名)**;DoH;多份名单(Disconnect、DuckDuckGo Tracker Radar 等)。自己写明：只能有一个 VPN、不支持和私人 DNS 同时用 |
| [blokadaorg/blokada](https://github.com/blokadaorg/blokada) | 3269 | 2026-11-03 | MPL-2.0 | v6 云端拦截(订阅);v5 本机、免费 | — |
| DuckDuckGo App Tracking Protection(在 [duckduckgo/Android](https://github.com/duckduckgo/Android) 里，4886 star) | — | 2026-11-04 | Apache-2.0 | 本机 VPN,拦截 App 里的第三方追踪 | 不能和别的 VPN 同时用 |
| [IngoZenz/personaldnsfilter](https://github.com/IngoZenz/personaldnsfilter) | 951 | 2026-10-31 | GPL-2.0 | 本机 DNS 过滤 | — |
| [M66B/NetGuard](https://github.com/M66B/NetGuard) | 3963 | 2026-08-01 | GPL-3.0 | 免 root 防火墙 | — |
| [Jigsaw-Code/Intra](https://github.com/Jigsaw-Code/Intra) | 2237 | 2026-09-16 | Apache-2.0 | 加密 DNS(DoH) | — |
| [julian-klode/dns66](https://github.com/julian-klode/dns66) | 2244 | 2026-03-02 | GPL-3.0 | 本机 DNS 拦截 | **已归档**(不再维护) |
| 参考:[AdAway](https://github.com/AdAway/AdAway) 9593、[PCAPdroid](https://github.com/emanuele-f/PCAPdroid) 5074、[InviZible](https://github.com/Gedsh/InviZible) 2872 | | | | hosts 拦截 / 抓包监控 / Tor 等 | |

结论：同类很多，最强的是 Rethink(功能最全)和 TrackerControl(追踪分析最深)。**Guardian 目前在功能广度上落后，而且还没有真机用户和真机测试**——不能说已经领先。

## 二、用户真正在抱怨什么(证据)

各项目点赞最多的 issue:
- Blokada:要按 App 断网(防火墙)**145**;要 DoT/DoH **114**;要知道是哪个 App 发的请求 **83**;要能和 OpenVPN/自己的 VPN 一起用 65 / 53;要拦截历史和排行 29。
- TrackerControl:要加密 DNS 16;要和 ProtonVPN 等 VPN 串联 7。
- Rethink:要集成 Tailscale 57、WireGuard 22;全局规则 19;多个 DNS 14。
- personalDNSfilter:深色模式 8;App 黑名单 7。

关键词出现次数(issue 标题和正文;4 个项目合计):「battery」耗电 121;「other VPN」和别的 VPN 冲突 65;「Private DNS」和系统私人 DNS 冲突 60;「breaks」把 App 弄坏 38。

归纳成 6 个痛点：① 把某个 App 弄坏了，不知道怎么救;② 耗电;③ 和别的 VPN / 私人 DNS 冲突;④ 想要加密 DNS;⑤ 想知道是哪个 App 在追踪;⑥ 看不懂、配置太多。

## 三、Guardian 现在的位置(如实)

| | Guardian | 说明 |
|---|---|---|
| **架构上可能更省电** | 只把 DNS 服务器地址路由进隧道(`addRoute(10.111.222.2/32)`),其他流量不经过 Guardian | Rethink、TrackerControl、DDG 都要处理全部流量。**但没有实测**,不能宣传「更省电」 |
| 拦截原因可见 | 每个被拦域名显示是哪条规则(G11) | 同类部分有 |
| CNAME 拆穿 | 本机完成(G14) | 同类里不普遍，但没逐个核实，不能说「唯一」 |
| 追踪公司名 | Exodus 数据(G15,G15b 去掉误导标签) | TrackerControl 更深(多份名单 + 库分析) |
| 隐私快速检查 | G16 | 这几个项目里没看到同类功能 |
| 加密 DNS | DoT,2 家(G18,模拟器还没过) | 落后 Rethink(4 种协议、任意服务商) |
| 哪个 App 在追踪 | **做不到**:安卓 10+ 所有 DNS 查询都来自系统解析服务 | TrackerControl/Rethink 因为接管全部流量才能做到。G17 静态扫描能说「含有」,TrackerControl 已有 |
| 和别的 VPN 共存 | 做不到(安卓只有一个 VPN 位置) | 同类也做不到，只能「串联」到指定 VPN |
| 名单更新 | 只随 App 更新 | 同类都能在线更新。Guardian 目前除了转发 DNS 不联网，这是取舍 |
| 上架、可复现构建 | 都没有 | 同类大多在 F-Droid |
| 真机验证 | 只有 Paul 的一张截图 | 最大的缺口 |

## 四、怎样领先：不拼功能数量，拼「最省心 + 最透明 + 最轻」

不去追 Rethink 的大而全(防火墙、WireGuard、Tailscale 都和 Guardian「只管 DNS、没有服务器」的定位冲突);V2Ray / Tor 类功能按规则 5 不做。下面每条都对应一个有证据的痛点，并写明怎么证明领先:

| 优先级 | 做什么 | 对应痛点 | 怎么证明 |
|---|---|---|---|
| 1 | **「某个 App 坏了」一键救援**:点一下，列出最近 60 秒内被拦的域名(带公司名和规则)，勾选后放行;也可以「对这个域名暂停 1 小时」 | ① App 被弄坏(breaks 38) | 模拟器流程 + 真机：从发现问题到恢复的点击次数(目标 ≤ 3) |
| 2 | **公开的耗电和延迟测量**:同一台手机，Guardian vs 不开 vs TrackerControl/Rethink,跑 1 小时看系统电池页和 DNS 延迟，结果和方法写进 README | ② 耗电(battery 121) | 这才是能拿出手的「技术先进」证据;在测之前一个字都不宣传 |
| 3 | **界面 v2 + 中英德日**(见 `2026-11-04-guardian-ui-v2-proposal.md`) | ⑥ 看不懂、太复杂 | 新用户首次开启的步骤数;四种语言键完全一致的 CI 检查 |
| 4 | **冲突说清楚、给出路**:检测到私人 DNS 开着时，说明后果并一键跳到设置(现在只有一行提示);检测到别的 VPN 抢占时，说明「安卓只允许一个 VPN」 | ③ 冲突(other VPN 65、Private DNS 60) | 模拟器里开私人 DNS 后看提示和跳转 |
| 5 | **加密 DNS 补齐**:修好 G18 模拟器，加「自定义 DoT 服务器」;DoH 要用 HTTPS,需要放宽 `policy_check.py` 的「不用 HttpURLConnection」规则，**需要 Paul 决定** | ④ 加密 DNS(114 + 16) | 模拟器：选服务商后能解析、连不上时如实失败 |
| 6 | **信任：可复现构建 + F-Droid** | 开源用户最看重 | F-Droid 收录、两次构建 APK 哈希一致 |
| 7 | G17 扫描已装 App:**不说独家**(TrackerControl 已有)，差异化放在「白话解释 + 建议怎么做(删权限 / 卸载 / 换替代品)」 | ⑤ 哪个 App 在追踪 | 真机扫描结果对照 Exodus 网站报告 |

名单更新是个要决定的取舍：要么继续只随 App 更新(最纯粹，名单会旧);要么允许从固定地址下载名单(要加 HTTPS 和签名校验，并改策略检查)。

## 五、请项目经理 / Paul 决定

1. 定位「最省心、最透明、最轻」，不追 Rethink 的功能广度——同意吗?
2. 第 1、2 条(一键救援、耗电实测)放到 U1/U2 之前还是之后?我建议一键救援和 U2 一起做(它本来就在「记录」页)，耗电实测放在 K1 真机测试里一起做。
3. DoH 和在线更新名单都需要放宽现有策略，要不要放宽?
