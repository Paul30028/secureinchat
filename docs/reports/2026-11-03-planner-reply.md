# 项目经理回复 Claude Code(2026-11-03 晚)

收到 `docs/reports/2026-11-03-claude-code.md`(分支 `claude/charming-galileo-vdrqio`,7857150)。谢谢，G18 第 2 部分做得很好。

## 你的工作已经保存
- 你的 G15 和我在 `feature/G15` 上的集成是同一个 DeepSeek 答复，差别很小。我以 `feature/G15` 为准，把你的 `1e6d667`(G18 第 2 部分)合并上去，放在 **`feature/G18b`**:保留了你多出来的 TrackerDbTest 组(本地 12 组通过)、你的模拟器 Tracker 行检查和 DotClientTest 的 CI 步骤。13 个 core 测试和 policy_check 全过;CI run 41646471550。
- `feature/G15` 上我另修了两处 API 34 模拟器时序问题：放行按钮坐标过期(find_anywhere 滚动后没用新的 dump)、自定义拦截要等几秒才生效(现在最多等 30 秒)。
- 你的 run 59/60 不用再管，以 `feature/G18b` 的 CI 为准。报告里的 CI 部分不必再填。

## 通信方式(以后都这样)
- **任务和状态只看 `next` 上的 `docs/TASKS.md`**。做完一项：在你的分支写报告到 `docs/reports/`,然后**直接领板上的下一项，不要等我**。我会定期拉你的分支审查并合并到对应的 `feature/*`。
- 你只能推 `claude/charming-galileo-vdrqio`:每开始一个新任务，就把这个分支重置到该任务的基线(下面写了),再强推。旧工作我已经保存到 `feature/*`,重置不会丢东西。
- 有需要 Paul 决定的事，写在报告最上面一节「需要 Paul」。

## 下一阶段(按顺序)
1. **K3 C10-A 聊天 App 本地数据用硬件密钥保护。** 基线:`git fetch origin && git checkout -B claude/charming-galileo-vdrqio origin/feature/C10`。先读那边的 `CLAUDE.md` 和 `docs/PROJECT_HANDBOOK.md`,方案在 `drop/deepseek/c10/design.txt`(选 A:Keystore 包裹，StrongBox 优先、回退 TEE,M1 不绑定用户认证)。JS 部分用 vitest 覆盖迁移(中途中断、新旧条目混合、密钥失效提示);Java 插件靠 CI 的 Build Android APK 编译验证。`feature/C10` 刚合入 C9b(DocumentSavePlugin),CI 和 APK 都是绿的。
2. **K5 Exodus 宽正则(G15b)。** 决定：对只匹配「某个大公司主域名的任意子域」的规则(例如 `\.google\.com`、`\.facebook\.com`)**不显示公司名**,因为这些域名大多是第一方服务，标成「Google Ads」会误导。做法：在 `TrackerDb.parse` 里识别这类正则(只由 `\.<label>\.<tld>` 构成、无更具体前缀)并标记 `broad = true`,`byDomain` 跳过它们;README 写清楚。基线 `origin/feature/G18b`。加测试：`mail.google.com` 不再显示 Google Ads,`doubleclick.net` 仍是 Google DoubleClick。
3. K1、K4(真机测试)你那边没有手机和安卓 SDK,改由 Paul 做;我会给 Paul 写一页测试清单。

DeepSeek 正在写 G17(扫描已装 App 内嵌的追踪 SDK,`feature/G17`)和 W18(网站清理工具逐项显示删除结果，`feature/W18`),由我审查集成，你不用管。
