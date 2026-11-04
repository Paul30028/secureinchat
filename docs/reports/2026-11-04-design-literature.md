# 支撑 Guardian / 聊天 App 设计的论文(Claude Code,2026-11-04)

每篇都在网上核对过题目、作者、会议和年份(数字来自摘要或公开报道，引用具体数字前请再看原文)。**这些论文证明的是「问题真实存在」和「设计原则」,不能证明我们的具体做法有效**——做法要靠我们自己的用户测试来验证。

## 一、跟踪软件与身边的施害者(→ 应用体检、跟踪软件告警、求助报告、账号清单)

| 论文 | 结论 | 支撑的设计 |
|---|---|---|
| Chatterjee et al., *The Spyware Used in Intimate Partner Violence*, IEEE S&P 2018 | 研究了 61 个商店内、9 个商店外的应用;多数是「两用」应用(儿童安全、防盗)，**反间谍软件工具普遍识别不出** | 不能只靠黑名单:体检同时看行为信号(无障碍、设备管理员、隐藏图标 + 敏感权限) |
| Roundy et al., *The Many Kinds of Creepware Used for Interpersonal Attacks*, IEEE S&P 2020 | CreepRank 排名前 1000 的应用里 857 个属于「creepware」，范围比 spyware 广 | 同上;用「为什么列出它」解释信号，而不是简单判定好坏 |
| Freed et al., *A Stalker's Paradise*, CHI 2018(最佳论文) | 89 名参与者;施害伴侣能直接拿到手机、知道或逼出密码、登录账号 | 账号与共享清单;锁屏中性告警;只告警不自动删除 |
| Havron et al., *Clinical Computer Security for Victims of Intimate Partner Violence*, USENIX Security 2019 | 44 名受害者的实地研究：由受过训练的技术人员帮助，能发现账号被入侵、可被利用的错误设置和可能的间谍软件 | 「给求助机构的最小报告」;账号清单(相当于把诊所的检查步骤做进 App) |

## 二、读屏攻击(→ 聊天 App「屏幕可能被读取」提醒)

| 论文 | 结论 | 支撑的设计 |
|---|---|---|
| Fratantonio et al., *Cloak and Dagger*, IEEE S&P 2017 | 无障碍服务 + 悬浮窗两个权限即可完全控制界面;20 名用户无人察觉 | 端到端加密挡不住读屏，聊天 App 要主动提醒 |

## 三、警告与可用性(→ 少而准的告警、白话、验真要省力)

| 论文 | 结论 | 支撑的设计 |
|---|---|---|
| Akhawe & Felt, *Alice in Warningland*, USENIX Security 2013 | 2500 多万次警告数据：警告**可以**有效，但**警告越频繁，注意力越低** | 动态告警只推 4 类高信号事件 |
| Felt et al., *Android Permissions: User Attention, Comprehension, and Behavior*, SOUPS 2012 | 安装时只有 17% 的人注意权限;问卷里只有 3% 答对全部理解题 | 不直接甩权限清单：分层、白话、说清后果 |
| Vaziripour et al., *Is that you, Alice?*, SOUPS 2017 | 用户很难找到并完成加密聊天的身份验证步骤 | 安装验真要做成「两部手机互扫一下」这么省力 |
| McGregor et al., *Investigating the Computer Security Practices and Needs of Journalists*, USENIX Security 2015 | 15 名记者访谈：妨碍工作的安全工具不会被使用 | 默认设置要零配置可用;高风险功能不能增加日常负担 |

## 四、高风险人群与全球南方(→ 按处境设置、无手机号、低端机、检查前模式)

| 论文 | 结论 | 支撑的设计 |
|---|---|---|
| Warford et al., *SoK: A Framework for Unifying At-Risk User Research*, IEEE S&P 2022 | 对约 95 篇研究的元分析，归纳出 10 个共同的情境风险因素(如被边缘化、掌握敏感资源) | 按处境设置(不同风险因素 → 不同默认值) |
| Ahmed et al., *Privacy, Security, and Surveillance in the Global South: A Study of Biometric Mobile SIM Registration in Bangladesh*, CHI 2017 | 3 个月田野调查 + 606 人问卷：生物识别手机卡实名带来身份、归属和信任方面的隐私与安全担忧 | 聊天 App 坚持不要手机号 |
| Sambasivan et al., *"Privacy is not for me, it's for those rich women"*, SOUPS 2018 | 南亚女性常共用手机、被家人查看;靠应用锁、删除内容、回避等方式维护隐私 | 低端/共用手机设计;内容隐藏;检查前模式 |
| Skillen & Mannan, *On Implementing Deniable Storage Encryption for Mobile Devices*(Mobiflage),NDSS 2013 | 安卓上可否认加密存储的实现，用诱饵密钥否认隐藏数据存在 | 胁迫 PIN / 检查前模式的技术先例(也说明实现难、可能被取证发现) |

## 五、Guardian 已做的功能

| 论文 | 结论 | 支撑的设计 |
|---|---|---|
| Dimova et al., *The CNAME of the Game*, PoPETs 2021 | CNAME 伪装追踪在快速增长，预印本报告前 1 万网站中 9.98% 使用 | G14 CNAME 拆穿 |
| Kollnig et al., *A Fait Accompli?*, SOUPS 2021 | 1297 个安卓应用：多数含第三方追踪，很少先征得同意 | G15 追踪公司名、G17 追踪库扫描 |

## 链接

- Chatterjee 2018:<https://www.cs.cornell.edu/~rahul/papers/IPV_Spyware.pdf>
- Roundy 2020:<https://pages.cs.wisc.edu/~roundy/papers/ieeesp-creepware.pdf>
- Freed 2018:<https://www.classes.cs.uchicago.edu/archive/2020/winter/20370-1/readings/Stalkers.pdf>
- Havron 2019:<https://www.usenix.org/conference/usenixsecurity19/presentation/havron>
- Fratantonio 2017:<https://www.ieee-security.org/TC/SP2017/papers/117.pdf>
- Akhawe & Felt 2013:<https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/akhawe>
- Felt 2012:<https://research.google/pubs/android-permissions-user-attention-comprehension-and-behavior/>
- Vaziripour 2017:<https://www.usenix.org/conference/soups2017/technical-sessions/presentation/vaziripour>
- McGregor 2015:<https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/mcgregor>
- Warford 2022:<https://arxiv.org/abs/2112.07047>
- Ahmed 2017:<https://www.dgp.toronto.edu/~rifat/files/paper4089.pdf>
- Sambasivan 2018:<https://www.usenix.org/conference/soups2018/presentation/sambasivan>
- Skillen & Mannan 2013:<https://www.ndss-symposium.org/ndss2013/implementing-deniable-storage-encryption-mobile-devices>
- Dimova 2021:<https://petsymposium.org/popets/2021/popets-2021-0053.php>
- Kollnig 2021:<https://www.usenix.org/conference/soups2021/presentation/kollnig>

## 用途

- OTF 等资助申请的「问题陈述」可以直接引用第一、四组。
- 要证明我们的做法有效，需要和 NGO 合作做小规模用户测试(Havron 2019 的诊所方法可以参考)。
