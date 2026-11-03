# 任务分派板(项目经理:Claude 云端会话;Paul 2026-11-03 授权)

**怎么用这块板**
- Claude Code 只能推 `claude/charming-galileo-vdrqio`:每个新任务把它重置到该任务的基线分支再强推;报告写在 `docs/reports/`,做完直接领下一项，不用等。
- 每个任务一个分支，分支名写在表里;只在自己的分支上改代码，避免互相冲突。
- 开始做:把「状态」改成「进行中(谁，日期)」，提交到 `next`(只改这个文件，小提交;冲突就 rebase)。
- 做完:状态改成「待审查」,写上分支和提交号、测试结果。不要自己合并到 `feature/guardian`、`feature/chat`、`main`——合并等 Paul。
- 规则见 `CLAUDE.md`,各分支现状见 `docs/ENGINEERING_STATUS.md`。
- 发现规格有问题：在任务行的「备注」里写清楚，不要自己改需求。

## 分工

| 成员 | 负责 |
|---|---|
| **Claude Code**(Paul 电脑上的会话) | 需要本机编译、真机测试或大量直接写代码的任务 |
| **DeepSeek**(经 Claude 云端会话) | 边界清楚的模块，按规格写;Claude 云端会话审查、测试、集成 |
| **Claude 云端会话** | 写规格、审查集成、CI、研究、资助申请、这块板 |
| **Paul** | 合并与上线、账号、付款、真机 |

## Claude Code 的任务(按顺序做)

| # | 任务 | 分支 | 状态 | 要点 |
|---|---|---|---|---|
| K1 | **Guardian 真机测试** | 不改代码;问题记到 `docs/device-test-guardian.md`(在 `next` 上) | 改由 Paul 做(Code 会话没有手机和 SDK) | 在 Paul 手机上装 `feature/G13` 的 debug APK(`cd guardian && ./gradlew assembleDebug`)。逐项测：启动/停止、拦截 doubleclick.net、放行 example.com、三档切换(sentry.io 只在严格档被拦)、暂停 5 分钟、自定义拦截/放行、导入导出、Always-on、Quick Settings 磁贴、拦截次数历史和清除、耗电(运行 1 小时看系统电池页)、和 Private DNS 同时开时的提示。每项写「通过/不通过 + 现象 + 手机型号和 Android 版本」。这是项目最大的缺口 |
| K2 | **G18 第 2 部分：加密 DNS 接入 App** | `feature/G18`(core 已完成：DotClient、DotProviders) | 完成(Code,1e6d667);已合到 `feature/G18b`,CI 41646471550 | `Socket()` → `VpnService.protect(socket)` → `SSLSocketFactory.getDefault().createSocket(sock, host, 853, true)`,`SSLParameters.endpointIdentificationAlgorithm = "HTTPS"`。设置项：关闭(默认)/ Quad9 / Cloudflare，存在 UserRulesStore。开启时所有转发走 DotClient;**连不上就失败，绝不回退明文 DNS**,状态行显示「Encrypted DNS: Quad9 — connected / unreachable」(中英文)。DoT 查询要在后台线程，不能卡 tun 读循环。测试:core 已有 DotClientTest;模拟器流程加一步：选 Quad9 后 example.com 能解析、日志 ALLOW;真机上再测一次(K1 的同一台手机)。文案只说「加密 DNS 让网络运营商看不到你查了哪些网站」，不做翻墙宣传 |
| K2b | **修 G18b 模拟器第 4g 步(先做，短)** | 基线 `origin/feature/G18b`(= feature/G15 + 你的 G18 第 2 部分) | **最先做**(Code)。CI run 41646471550:API 29 上 `resolve(dot_probe)` 里的 ping 超过 30 秒,`subprocess.TimeoutExpired` 没被捕获，整个流程崩溃——DoT 连不上时应该很快 SERVFAIL,查清是服务慢还是测试问题;`resolve()` 也要捕获超时。API 34 上自定义拦截 example.org 30 秒内没生效(同样的测试在 feature/G15 上通过)，查是不是 G18 第 2 部分改了转发路径。修好后 CI 两个模拟器都绿，写报告。 |
| K3 | **C10-A:聊天 App 本地数据用硬件密钥保护** | `feature/C10`(聊天线，读那边的 CLAUDE.md) | K2b 之后(Code,见 `docs/reports/2026-11-03-planner-reply.md`) | 方案见 `drop/deepseek/c10/design.txt` 和 CLAUDE.md:自写 `KeystorePlugin.java`(AES-GCM 硬件密钥，StrongBox 优先、失败回退 TEE，记录实际级别);JS 侧新主密钥(可导出 → 包裹 → 丢弃原始字节 → 导入为不可导出);双密钥 keyring + 后台全量迁移(断电安全);M1 **不绑定用户认证**;密钥失效时提示「本机数据无法解密，请从备份恢复」并引导到备份页;Web 端保持现状并写明保护级别较低。README 和「我的」页如实写：防「拷走数据目录离线解密」，不防「已解锁设备上的在线提取」。要有迁移测试(中途中断、新旧条目混合)和真机验证 |
| K4 | **聊天 App 真机测试** | 不改代码;记到 `docs/device-test-chat.md`(聊天线 `feature/C10`) | 改由 Paul 做 |
| K5 | **Exodus 宽正则不显示公司名(G15b)** | 基线 `feature/G18b` | K3 之后(Code) | 两台手机(或手机 + 模拟器):建群、扫码加群、文字/图片/语音/文件、一对一通话、阅后即焚、应用锁和指纹、截屏保护、备份导出与恢复(C9b 合入后)、断网重连 |

## DeepSeek 的任务(Claude 云端会话负责发规格、收答复、审查集成)

| # | 任务 | 分支 | 状态 |
|---|---|---|---|
| D-G15 | 拦截记录显示追踪公司(Exodus 数据) | `feature/G15` | 已审查集成;修了两处模拟器测试的时序问题(放行按钮坐标过期、自定义拦截生效要等几秒),等 CI 41645491723 |
| D-G16 | 隐私快速检查(只打开系统设置：删除广告 ID、精确位置、应用权限) | `feature/G16` | 已审查集成:文案改得不夸大，去掉一个未公开的 Intent;模拟器加 5c 步;CI run 41643910622 全绿。待 Paul 合并 |
| D-C9b | 自写 DocumentSavePlugin，备份导出在真机能保存 | `feature/C10` | 已审查集成(271 个测试通过;顺手修了一个原有的阅后即焚测试抖动)。APK 由 CI 构建，真机验证归 K4 |
| D-G17 | 扫描已装 App 内嵌的追踪 SDK(TrackerDb.byClassName;写「含有」不写「在用」) | `feature/G17`(从 G16 分出) | 规格已发 DeepSeek |
| D-W18 | 照片/文件清理工具：清理后列出删掉了哪些字段，并自动重新检查一遍(来自用户痛点调研) | `feature/W18` | 待审查(守护会话直接写，未走 DeepSeek):1501960。新模块 cleandiff.js + 两个清理工具清理后逐类显示「已删除/仍然存在」和「再次检查」行;PNG/WebP 不做逐项声明。cleandiff 单元测试 11 项(做过变异检查),tools2/mrpage/zhphoto/zhfile 加了断言;22 组页面测试 + 20 个 node 测试全过。未合并 next、未上线 |

## Claude 云端会话自己的任务

| # | 任务 | 状态 |
|---|---|---|
| C-G13 | G13 CI 收尾 | 完成:run 41639990376 全绿，等 Paul 合并 |
| C-REL | 中继成员资格校验的设计(OTF 第一个里程碑) | 待做 |
| C-OTF | OTF 申请：等 Paul 注册账号和两句真实信息 | 等 Paul |

## 已合并 / 已上线(2026-11-03 晚，Paul 授权)

- **网站上线**:D5 新首页(中英文)+ `next` 上的 W16、W17、M1 已发布到 `main`(3925729),线上已确认。发布前删掉了 `drop/` 草稿;22 组页面测试 + 9 个 node 测试全过。
- **聊天线** `feature/chat` ← C9 备份、C9b 真机保存、AGPL 许可证(c8e0ae1);271 个 App 测试、129 个中继测试通过。
- **Guardian** `feature/guardian` ← G12、G13、G14、G15、G16:合并分支 `merge/guardian-1103`,CI run 41649442209 绿了才推。G18b 等 K2b 修好再合。
- 注意:`main` 上的「Workers Builds: secureinchat」检查从 10-31 起一直失败，但网站是另一条部署路径发布的(线上已更新)。那个 Workers 项目可能是多余的，需要 Paul 在 Cloudflare 后台看一眼。
