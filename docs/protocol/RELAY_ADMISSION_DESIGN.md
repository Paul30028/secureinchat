# 中继成员资格校验设计(C-REL,草案 v1,2026-11-03)

状态:**设计草案,待 Paul 审查。没有写代码,没有改协议,没有部署。**
范围:`server/relay`(本仓库的 next 中继)+ `packages/protocol`(SIC2)+ `packages/chat-core`(RelayClient)。
不涉及生产中继 `ws.secureinchat.com`(旧仓库)。

## 1. 现状(按 feature/chat c8e0ae1 的代码核对)

- `RelayServer` 支持可选的 `GroupMembership` + `InviteRegistry` 关卡(`app/server.py` 第 85 行起),
  但 `main.py` 两者都没传,注释写明是故意的:App 端没有「向中继登记邀请码」的流程,
  开了关卡所有人都会被挡下。结果:**任何走完设备握手的设备,自称哪个 `groupId` 就能进哪个群**
  (`docs/RELAY_TECHNICAL_SPEC.md` 第 10 节也这样写)。
- `GroupMembership`、`InviteRegistry` 都是纯内存,重启即清空;`InviteRegistry` 需要有人事先
  `register(serverJoinCode, …)`,但没有任何帧能做这件事。
- 进群的人能做到的事(读不到内容,因为没有群密钥):看到在线设备名单和上下线(`presence`、
  `peer_joined/left`);收到全部密文和它们的大小、时间;给群里发垃圾帧、会议邀请,向某台设备
  定向发通话信令(受每设备每窗口 30 帧的限流约束,`app/rate_limit.py`)。
- 移出成员靠换钥匙(`PROJECT_HANDBOOK.md` 3.3)。被移出的人读不到新消息,但**仍能连上中继、
  看到谁在线、往群里塞帧**——中继不知道他已经不是成员。
- 换钥匙不需要管理员私钥:`App.tsx` 的 `handleRotateKey` 调 `rotateGroupKey` 生成新邀请串,
  全程不读 `loadAdminKey`。别的客户端收到 epoch 更高的 SIC2 邀请就会接受。也就是说,
  谁能打开这个界面谁就能「换钥匙」并分发新邀请(管理员界面的本地解锁按手册 3.2 不构成权限)。
  这一点不是中继的问题,但下面的设计顺带把它堵上。

另:`RELAY_TECHNICAL_SPEC.md` 第 10 节写「没有限流」,但 `RelayServer.__init__` 无条件创建了
连接限流和消息限流——文档过时,实现时顺手改。

## 2. 目标与非目标

目标
1. 只有持有该群**当前 epoch** 邀请材料的设备能通过中继的成员资格检查。
2. 换钥匙后,旧 epoch 的设备立刻连不上(移出成员在中继层面也生效)。
3. 新 epoch 只能由群管理员(持有建群时那把 ECDSA 私钥的人)开启;没有私钥的客户端换钥匙,中继不认。
4. 中继不多知道「谁是管理员」(手册 3.1),不保存消息,不需要账号。
5. 旧客户端有过渡期,不会一刀切断。

非目标(本设计不做)
- 不追求「中继被攻破也安全」:中继保存的入群校验密钥被偷,偷的人能通过成员资格检查
  (仍读不到内容)。成员资格检查防的是「知道 groupId 的外人」和「已被移出的人」,不防中继本身。
- 不做服务端的邀请次数/有效期限制(SIC2 的 `exp`、`uses` 目前只在客户端检查)。见第 8 节。
- 不做 MLS、不做逐成员密钥、不改消息加密。
- 不做安全码(Paul 已否决)。

## 3. 方案概要

每个群在中继上只有一条记录,**没有成员名单**:

```
groups(group_id PK, admin_pubkey, epoch, admission_key, updated_at)
```

- `admission_key`(入群校验密钥,32 字节):客户端从邀请材料用 HKDF 派生,和消息密钥用**不同的
  info**,所以中继拿到它也推不出消息密钥。
  `admission_key = HKDF-SHA256(ikm = km, salt = "secureinchat:group-salt:<gid>", info = "secureinchat:relay-admission:v1:<epoch>")`,
  输出 32 字节(`deriveBits`)。salt 与 `deriveGroupEpochKey` 相同,info 不同(域分离)。
- `admin_pubkey`:邀请串里已有的 `apk`(65 字节 P-256 公钥,建群时生成)。中继第一次见到这个群时记下,
  **之后永不更换**。
- **开启某个 epoch 的凭证**(admission statement,下称「开群凭证」):管理员在建群和换钥匙时用私钥签:
  ```
  "secureinchat:relay-admission:v1\n" + gid + "\n" + epoch + "\n" + base64url(SHA-256(admission_key))
  ```
  签名格式与公告签名相同(ECDSA P-256 / SHA-256,P1363)。它写进 SIC2 邀请串的新字段 `ras`,
  **所有成员都拿到同一份**。

### 3.1 连接时的判断(中继)

客户端在 `auth_response` 里多带一个 `admission` 对象(只在中继宣布支持时带,见第 5 节):

| 中继上的记录 | 客户端出示的 epoch | 客户端要带 | 中继做什么 |
|---|---|---|---|
| 没有这个群 | e | `apk`、`ras`、`admissionKey` | 用 `apk` 验 `ras`;核对 SHA-256(`admissionKey`);对 `g2-` 群再核对 gid 与 apk 绑定(3.3)。通过就建记录,放行 |
| epoch = e | e | `mac` = HMAC-SHA256(admission_key, "secureinchat:relay-admission-proof:v1\n" + nonce + "\n" + deviceId + "\n" + gid) | 常数时间比较,通过放行 |
| epoch < e | e | `ras`、`admissionKey` | 用**已记下的** `admin_pubkey` 验 `ras`(不接受客户端带来的新 apk);通过就把记录换成 e,放行。旧 epoch 的设备从此失败 |
| epoch > e | e | — | `auth_failed`,reason `"stale epoch"`。客户端提示「群密钥已更换,请向管理员要新的邀请」 |

失败一律 `auth_failed`,reason 只用固定几种(`"admission required"`、`"bad admission"`、`"stale epoch"`),
不回显细节。失败计入现有的按来源 IP 连接限流。

`mac` 绑定 nonce(每次连接新的)、deviceId 和 gid,所以抓到一次握手帧也不能拿去重放或换群用。
`admissionKey` 只在「建记录 / 升 epoch」两种情况出现,走 wss(TLS)。

### 3.2 为什么这样能满足目标

- 目标 1:没有当前 epoch 的邀请材料就算不出 `admission_key`,也就算不出 `mac`。
- 目标 2:管理员换钥匙后会立刻用新邀请重连(`handleRotateKey` 已经这样做),中继在这一刻升 epoch;
  被移出的人只有旧材料,之后全部 `stale epoch` 或 `bad admission`。
- 目标 3:升 epoch 必须带用已记下的管理员公钥验得过的 `ras`。没有私钥的客户端做不出来;
  它分发的「新邀请」在更新后的中继上进不了群。客户端也应同步改:**接受更高 epoch 的邀请前先验 `ras`**
  (客户端已经有 `apk`,不需要中继)。
- 目标 4:`ras` 写在每个成员的邀请里,任何成员第一次连新 epoch 都可能是提交者,中继分不出谁签的。
  中继新知道的只有:每个群一把随机的管理员公钥(不对应任何账号或设备)、epoch 次数和换钥时间、
  admission_key。它今天本来就知道「第一个连上这个 groupId 的设备」,通常就是建群者——这一点本设计
  既没有改善也没有变差,文档要如实写。

### 3.3 抢注风险和 `g2-` 群号

「中继第一次见到群时记下 apk」有一个窗口:如果在建群者连上之前,别人先拿这个 gid 去建记录,
他就能把自己的公钥钉上去。能这么做的人必须知道 gid,而 gid 只出现在邀请串里(和中继自己)——
所以只有已经拿到邀请的人能抢注,而建群流程里建群者会马上连接(`CreateGroupScreen.handleEnter`)。

新建的群可以彻底消除这个窗口:gid 改成由管理员公钥算出
`g2-` + base64url(SHA-256(apk)) 的前 32 个字符(现在是 `group-<uuid>`)。
中继对 `g2-` 开头的 gid 校验这个绑定,不对就拒绝建记录。老的 `group-` 群只能先到先得,风险写进文档。

### 3.4 没有 `apk` 的老群

SIC1 兼容邀请和早期没有 `apk` 的群做不了开群凭证。它们留在「开放」状态(和今天一样),
App 里这类群显示「这个群的服务器不校验成员,请让管理员重建群」——这是如实提示,不是新功能按钮。

## 4. 邀请串改动(SIC2 内,兼容)

新增可选字段 `ras`(开群凭证,base64url 签名)。旧客户端忽略未知字段(`parseSic2Invite` 只读认识的字段),
所以新邀请旧 App 也能解析。新 App 收到没有 `ras` 的邀请:能入群,但不带 `admission`(等同旧客户端)。

邀请串会长 86 个字符左右(64 字节签名的 base64url),二维码要重新量一次尺寸(未测)。

## 5. 版本协商与过渡期

- `auth_challenge` 增加 `features: ["admission-v1"]`。旧中继没有这个字段,新客户端就不带 `admission`。
- 中继环境变量 `SECUREINCHAT_ADMISSION`:
  - `off`:今天的行为。
  - `sticky`(建议的过渡默认):**群一旦在中继上有了记录,就只接受带有效 admission 的连接**;
    还没有记录的群照旧开放。这样不需要全局切换日期:某个群里第一个升级的成员(通常是管理员换一次钥匙,
    或建新群)连上后,这个群就收紧了;群里还在用旧 App 的人会收到 `auth_failed "admission required"`,
    新 App 才认识这个 reason 并提示更新,旧 App 只会显示连接失败——**过渡期的代价,要在发布说明里写**。
  - `required`:没有记录的群也拒绝(只接受第一次建记录的连接)。等所有已知用户都升级后再开。
- 记录存在 SQLite(和 `SqliteDeviceRegistry` 同一个文件、单独一张表),重启不丢;
  否则重启后被移出的人可以用旧 epoch 抢先建记录。

## 6. 现有代码怎么处理

- `GroupMembership`(按 deviceId 记成员)不再需要:每次连接都重新证明持有当前 epoch 材料。
  建议保留到新关卡上线,再删除,连同 `test_membership*.py`。
- `InviteRegistry` 继续不接线(第 8 节)。
- `pubkey_auth.verify_with_public_key` 目前只签 nonce 字符串,改成接受任意字节,供验 `ras` 复用。
- 客户端:`buildSic2Invite` 增加 `ras`;`CreateGroupScreen` 和 `handleRotateKey` 用管理员私钥签
  (`handleRotateKey` 没有管理员密钥时应拒绝换钥匙,并说明原因);RelayClient 在 `features` 含
  `admission-v1` 时带 `admission`;接受更高 epoch 邀请前验 `ras`。
- 管理员换手机:恢复码恢复的是同一把私钥,公钥不变,中继记录照常可用。

## 7. 测试计划(实现时必须有)

中继(pytest,当前 129 项全过):
1. 新群:有效 `ras` + `admissionKey` → 建记录、放行;`ras` 签名错 / `admissionKey` 与哈希不符 / 缺字段 → 拒绝且不建记录。
2. 同 epoch:正确 `mac` 放行;错 `mac`、换了 deviceId、换了 gid、旧 nonce 的 `mac` → 拒绝。
3. 升 epoch:已钉管理员公钥签的 `ras` → 升级,之后旧 epoch 的 `mac` 全部拒绝;客户端带来另一把 apk 签的 `ras` → 拒绝且记录不变。
4. 降 epoch / 重放旧 `ras` → `stale epoch`,记录不变。
5. `g2-` gid 与 apk 不绑定 → 拒绝建记录。
6. `sticky`:有记录的群拒绝不带 admission 的旧客户端;没记录的群放行旧客户端;`off` 时行为与今天逐字节相同(跑现有全部测试)。
7. 重启后记录仍在(SQLite)。
8. 跨语言:TS 客户端算出的 admission_key、`mac`、`ras` 用固定向量在 Python 侧验过(仿 `tests/fixtures/ts_signed_auth.json`)。
9. 变异检查:把常数时间比较改成恒真、把 epoch 比较方向写反,对应测试必须失败。

客户端(vitest):admission_key 派生与消息密钥不同;换钥匙没有管理员密钥时拒绝;收到无有效 `ras` 的更高 epoch 邀请时不接受;
`relayClient.integration.test.ts` 加一条:拉起 `SECUREINCHAT_ADMISSION=sticky` 的中继,建群 → 第二台入群 → 换钥匙 → 第二台旧材料被拒。

真机:两台手机建群、入群、换钥匙、旧手机被拒并看到提示(归 K4 那张清单)。

## 8. 留给以后的(本设计明确不做)

- **服务端的邀请有效期和次数**:要做的话需要中继记下「哪些 deviceId 已经用过邀请」(否则邀请过期后老成员也进不来),
  即重新引入成员名单,中继会多知道群成员构成。先不做,邀请过期仍只由客户端判断,文档如实写。
- **入群校验密钥轮换而不换群密钥**:例如怀疑中继数据库泄露时。可以加 info 里的计数器,暂不需要。
- 中继按群限流(现在按设备)。

## 9. 需要 Paul 决定

1. 中继记下每个群的管理员公钥和 epoch 换钥时间,可以吗?(它不对应任何身份,但比「中继什么都不记」多一点元数据。)
2. 换钥匙改为必须持有管理员私钥(现在任何能打开管理界面的人都能做)。
3. 新群 gid 改为 `g2-` 格式。
4. 过渡默认用 `sticky`;旧 App 在已收紧的群里会连不上,需要在发布说明里提醒更新。

## 依据

- 本仓库代码(feature/chat c8e0ae1):`server/relay/app/server.py`、`membership.py`、`invite_registry.py`、`pubkey_auth.py`、
  `rate_limit.py`、`main.py`;`packages/protocol/src/sic2/codec.ts`;`packages/crypto-core/src/keyDerivation.ts`、`adminSignature.ts`;
  `packages/chat-core/src/keyRotation.ts`、`relayClient.ts`;`apps/android-client/src/App.tsx`(`handleRotateKey`)、`screens/CreateGroupScreen.tsx`;
  `docs/PROJECT_HANDBOOK.md` 第 3 节;`docs/RELAY_TECHNICAL_SPEC.md` 第 10 节;`docs/security/THREAT_MODEL.md`。
- HKDF:RFC 5869 https://www.rfc-editor.org/rfc/rfc5869 (info 参数用于把派生结果绑定到具体用途,第 3.2 节)。
- Web Crypto HKDF `deriveBits` 与 HMAC:https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits 、
  https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign
