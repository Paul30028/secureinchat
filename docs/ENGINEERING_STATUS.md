# 工程进度与下一步(2026-11-03)

规则见根目录 `CLAUDE.md`。所有改动都在功能分支上，没有合并到 `next` 或 `main`,除非下表写了「已合并」。

## Guardian

| 任务 | 分支 | 状态 |
|---|---|---|
| G1–G11 | `feature/guardian` | 已合并(DNS 拦截核心、VPN、名单、IPv6、磁贴、暂停、自定义规则、Always-on、导入导出、拦截原因) |
| G12 拦截次数历史(每天只存一个数字) | `feature/G12` | CI 全绿(run 41312390338)，等 Paul 合并 |
| G13 拦截强度三档(HaGeZi Light / Multi / Pro) | `feature/G13` | 代码审查通过。模拟器测试连续修了三处测试问题(10 行日志滚走;scorecardresearch.com 在 extra 名单里，改用 sentry.io;状态行滚出视野)。三档切换本身已验证通过;run 41639990376 在跑 |
| G14 CNAME 拆穿(Claude 写) | `feature/G14`(基于 G12) | CI 全绿(run 41314385340)。CnameTest 11 组 + 变异检查 |
| G15 拦截记录显示追踪公司(Exodus 数据，ODbL) | `feature/G15`(基于 G14) | 数据和规格已提交;DeepSeek 答复在 `drop/deepseek/g15/round1.txt`(22 个代码块：TrackerDb.kt、TrackerDbTest.kt、GuardianVpnService 和 MainActivity 锚点)，**待审查应用** |
| G16 隐私快速检查(只打开系统设置：删除广告 ID、精确位置、未用 App 自动撤权) | 待建 `feature/G16`(基于 G15) | 已发给 DeepSeek(Guardian 对话)，答复待收 |
| G17 扫描已装 App 内嵌的追踪 SDK | — | 待写规格。用 `TrackerDb.byClassName` 对 dex 类名;结果写「含有」不写「在用」;需要 QUERY_ALL_PACKAGES(Paul 11-01 已授权),要在 `policy_check.py` 允许列表里加并注明 |
| G18 加密 DNS 第 1 部分(Claude 写) | `feature/G18`(基于 G14) | 完成:`DotClient`(DNS over TLS，失败即关闭、绝不明文回退)、`DotProviders`(Quad9、Cloudflare;Mullvad 公共 DNS 已于 11-02 停止);策略检查只允许在 DotProviders.kt 出现公共解析器 |
| G18 第 2 部分：接入 App | — | 待做:`Socket()` → `protect(socket)` → `SSLSocketFactory.getDefault().createSocket(sock, host, 853, true)`,`SSLParameters.endpointIdentificationAlgorithm = "HTTPS"`;界面选项：关闭(默认)/ Quad9 / Cloudflare;连不上时显示状态，不回退明文 |
| 可复现构建、F-Droid | — | 计划中 |
| **真机测试** | — | **从没做过**,最重要的缺口。需要 Paul 的手机，或在 Paul 电脑上用 Claude Code + 安卓 SDK |

Guardian 合并顺序建议:G12 → G13 → G14 → G15 → G16 → G18。G14/G15/G18 基于 G12，合并 G13 后可能要解决 MainActivity 和 emulator_flow.py 的小冲突。

## 聊天 App(`feature/chat` 系列，另一条代码线)

| 任务 | 分支 | 状态 |
|---|---|---|
| C1–C8 | `feature/chat` | 已合并(截屏保护、语音时长、生物识别、邀请卡片、阅后即焚等) |
| C9 加密备份与恢复 | `feature/C9` | CI 和 APK 构建全绿，等 Paul 合并。恢复只添加本机没有的群(防止旧备份降级 epoch，也防止内存会话覆盖) |
| C9b 真机能保存备份文件(自写 DocumentSavePlugin，SAF) | `feature/C10` 上 | Android WebView 不处理 blob 下载，导出在真机上会没反应。规格 `drop/claude/c9b.txt` 已发 DeepSeek(聊天 App 对话)，答复待收 |
| C10 本地数据静态加密 | `feature/C10` | 已定方案:A(Android Keystore 硬件密钥包裹主密钥，StrongBox 优先)作为 M1，不绑定用户认证并如实说明边界;C(硬件 + PIN)作为 M2。DeepSeek 的方案比较在 `drop/deepseek/c10/design.txt`。下一步写 C10-A 正式规格 |
| 开源许可证与英文 README、SECURITY.md | `feature/chat-license` | 完成，等 Paul 合并(OTF 申请需要) |
| 中继成员资格校验 | — | 未做;OTF 第一个里程碑 |

## 网站

| 任务 | 分支 | 状态 |
|---|---|---|
| W16、W17 中文指纹测试页、中文网站体检页 | `next` | 已合并到 next，未上线 |
| D4 + D5 首页改版(DeepSeek 6/7 号版式 + 按用户痛点改) | `design/deepseek-layout`(已合并 next) | 全部测试通过，截图已给 Paul，**等 Paul 同意上线** |

## 研究和资料(在 claude.ai 项目「盈利计划」里)

- 用户痛点:`docs/user-pain-research-2026-10-31.md`
- GitHub 优秀项目对比:`docs/github-teardown-2026-10-31.md`
- Guardian 技术先进性研究:`docs/guardian-advancement-research-2026-11-01.md`
- 资助申请(OTF 概念说明已写好，NLnet 本轮不适用):`docs/grants-2026-10-31.md`

## 需要 Paul

1. 合并:G12、G13(绿了以后)、G14 → `feature/guardian`;C9、`feature/chat-license` → `feature/chat`。
2. 同意 D5 首页上线(把 `design/deepseek-layout` 合并到 `main`;回退点是当前 `main`)。
3. OTF:注册账号，提供两句真实信息(你的背景;用户是谁、你怎么知道他们的需要)。
