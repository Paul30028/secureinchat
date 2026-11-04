import { useEffect, useRef, useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import {
  joinGroupFromInvite,
  MissingGroupIdError,
  RelayClient,
  FileAssembler,
  buildFileEnvelopes,
  rotateGroupKey,
  loadKnownDevices,
  removeGroup,
  renameGroup,
  clearMessages,
  saveKnownDevices,
  markDeviceSeen,
  forgetAllDevices,
  sendFileEnvelopes,
  addLatencySample,
  recordDisconnect,
  recordReconnect,
  EMPTY_LATENCY_STATS,
  type LatencyStats,
  type DisconnectRecord,
  loadMessages,
  saveMessages,
  loadJoinedGroups,
  saveJoinedGroups,
  upsertGroup,
  copyToClipboard,
  buildReplyExcerpt,
  sanitizeExpiresInMs,
  expiresAtFor,
  partitionExpired,
  nextExpiryMs,
  setDisappearAfter,
  mergeRestore,
  type BackupPayload,
  type AnnouncementCategory,
} from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { JoinGroupScreen } from "./screens/JoinGroupScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { CreateGroupScreen } from "./screens/CreateGroupScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen, type DisplayMessage } from "./screens/ChatScreen";
import type { TodayContent } from "./screens/TodayScreen";
import { AdminPublishScreen } from "./screens/AdminPublishScreen";
import { QrScanScreen } from "./screens/QrScanScreen";
import { AdminRecoveryScreen } from "./screens/AdminRecoveryScreen";
import { LockScreen } from "./screens/LockScreen";
import { ConnectionDiagnosticsScreen } from "./screens/ConnectionDiagnosticsScreen";
import { ConnectedDevicesScreen } from "./screens/ConnectedDevicesScreen";
import { ConferenceScreen } from "./screens/ConferenceScreen";
import { EditProfileScreen } from "./screens/EditProfileScreen";
import { GroupSettingsScreen, disappearLabel } from "./screens/GroupSettingsScreen";
import { GroupInviteScreen } from "./screens/GroupInviteScreen";
import { BackupScreen } from "./screens/BackupScreen";
import { disableLock } from "./appLock";
import { isAdminUnlocked, setAdminUnlocked } from "./adminAccess";
import { saveAdminKey, loadAdminKey } from "./adminKeys";
import { CallScreen } from "./screens/CallScreen";
import {
  CallSession,
  type CallKind,
} from "@secureinchat/webrtc";
import {
  getDeviceStore,
  getDeviceIdentity,
  resetLocalEncryptedData,
} from "./deviceIdentity";
import { KeyUnavailableScreen } from "./screens/KeyUnavailableScreen";
import { randomUUID, signAnnouncement, verifyAnnouncement } from "@secureinchat/crypto-core";
import { RELAY_URL, ICE_CONFIG } from "./relayConfig";
import { ServerSettingsScreen } from "./screens/ServerSettingsScreen";
import { MessageSearchScreen } from "./screens/MessageSearchScreen";
import { loadSavedRelayUrl } from "./relayUrlSetting";
import { ProfileSetupScreen } from "./screens/ProfileSetupScreen";
import { loadNickname, saveNickname, displayNameFor } from "./profile";
import { fromStored } from "./messageMapping";
import { PersistedMediaCache, SerialSaver } from "./mediaPersistence";
import {
  patchSession,
  sortSessions,
  unreadFor,
  previewFor,
  type GroupSession,
  type GroupSessions,
} from "./groupSession";
import { isSecureContextAvailable, InsecureContextNotice } from "./SecureContextGuard";
import { screenSecuritySupported } from "./screenSecurity";
import {
  authenticateBiometric,
} from "./biometricUnlock";

import { LIST_SCREEN, type ActiveCall, type Screen } from "./app/types";
import { formatExpiry, mapParseErrorReason, parsedInviteFor } from "./app/invite";
import { useDeviceSecurity } from "./app/useDeviceSecurity";
import { useGroupInvite } from "./app/useGroupInvite";
import { useConference } from "./app/useConference";
import { exportBackup, previewRestore } from "./app/backup";
import { t } from "./i18n";
import { BusyScreen, CapabilityProblemScreen } from "./screens/StartupScreens";
import { sendProgressText } from "./i18n/labels";

let nextMessageId = 0;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "connected", activeGroupId: null, view: "list", deviceId: "" });
  // 应用内配置的中继地址优先于构建时注入的默认值——换服务器不用重新打包
  const [relayUrl, setRelayUrl] = useState<string>(RELAY_URL);
  // 会话不放在 screen 里——导航到别的页面（比如去加入另一个群）不该断开
  // 已经连上的群。之前放在 screen 里时，回启动页会把所有连接一起丢掉。
  const [sessions, setSessions] = useState<GroupSessions>({});
  // setSessions 是异步的，而"这是不是第一个群"要在下一次 connect 前就准确——
  // 用 ref 镜像一份当前值供同步判断
  const sessionsRef = useRef<GroupSessions>({});
  // 启动时的自动重连期间为 true，用来区分"用户主动加入"和"后台恢复"
  const isAutoReconnectRef = useRef(false);
  // 从聊天页返回时要落在消息 tab，而不是默认的公告 tab
  const cameFromChatRef = useRef(false);
  const myDeviceIdRef = useRef("");
  /** 每个群一条写入链，避免设备名单的读改写互相覆盖 */
  const deviceWriteChainRef = useRef<Map<string, Promise<void>>>(new Map());
  // 公告音频的分片和公告本身谁先到都有可能，两边各记一份等对上
  const pendingAudioRef = useRef<Map<string, AnnouncementCategory>>(new Map());
  const arrivedAudioRef = useRef<Map<string, string>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);

  // 截屏保护、应用锁、指纹解锁、能力自检、本机主密钥——都是「这台设备」的状态，和群无关
  const {
    screenSecurityEnabled,
    handleToggleScreenSecurity,
    locked,
    setLocked,
    lockEnabled,
    setLockEnabledState,
    capability,
    keyProblem,
    dataProtection,
    probeMasterKey,
    showLockSetup,
    setShowLockSetup,
    biometricSupported,
    biometricEnabled,
    setBiometricEnabled,
    handleToggleBiometric,
  } = useDeviceSecurity();
  /** 发布圣诗音频时的进度文案 */
  const [publishProgress, setPublishProgress] = useState<string | null>(null);
  // 通话工厂：连上群时才赋值（见 connectToGroup），一对一通话和会议都用它
  const callFactoryRef = useRef<((callId: string, peer: string, kind: CallKind) => CallSession) | null>(null);
  const { conference, conferenceElapsed, handleConferenceFrame, startConference, leaveConference, toggleConferenceMute } =
    useConference(callFactoryRef, myDeviceIdRef);
  // 连接质量统计。跨群共用一份——它们走的是同一条网络、同一台中继，
  // 分群统计只会把样本切碎，看不出趋势。
  const [latency, setLatency] = useState<LatencyStats>(EMPTY_LATENCY_STATS);
  const [disconnects, setDisconnects] = useState<DisconnectRecord[]>([]);

  useEffect(() => {
    void isAdminUnlocked().then(setIsAdmin);
  }, []);

  /** 界面上是否显示发布入口：既要解锁过，也要真的持有某个群的管理员私钥 */
  const [holdsAdminKey, setHoldsAdminKey] = useState(false);
  useEffect(() => {
    const groupIds = Object.keys(sessions);
    if (groupIds.length === 0) {
      setHoldsAdminKey(false);
      return;
    }
    void Promise.all(groupIds.map((id) => loadAdminKey(id))).then((keys) =>
      setHoldsAdminKey(keys.some(Boolean))
    );
  }, [sessions]);

  const settingsGroupId =
    screen.name === "groupSettings" || screen.name === "groupInvite" ? screen.groupId : null;
  const inviteGroupId = screen.name === "groupInvite" ? screen.groupId : null;
  const { groupSettingsAdminAvailable, groupInviteState } = useGroupInvite(settingsGroupId, inviteGroupId);
  /** 正在回复的消息（每个群独立） */
  const [replyTarget, setReplyTarget] = useState<DisplayMessage | null>(null);
  const [nickname, setNickname] = useState<string | undefined>(undefined);
  // 设置完昵称后要重新执行用户原本的动作，但那个回调是设置之前创建的闭包，
  // 里面读到的还是旧的 nickname（undefined），会被再拦一次。用 ref 读当前值。
  const nicknameRef = useRef<string | undefined>(undefined);
  // 当前会话的落盘函数——连接建立时才知道 groupId 和 store，所以放 ref 里
  const persistRef = useRef<((messages: DisplayMessage[], mediaBytesById?: Map<string, Uint8Array>) => void) | null>(
    null
  );
  // 已经落盘过的媒体内容（每群 id → base64）。每次整体落盘都按 id 补回，
  // 否则下一次保存会把之前存过的图片/语音内容丢掉（C8）。
  const mediaCacheRef = useRef(new PersistedMediaCache());
  // 每个群的写入排队，保证后调用的保存后完成（不会被旧列表覆盖）。
  const saverRef = useRef(new SerialSaver());

  /**
   * 落盘某个群的消息列表：同步组装（保持缓存和调用顺序一致），再排队写入。
   * newBytes 是这次新到的媒体原始字节（通常只有一条）。
   */
  function saveGroupMessages(
    store: Awaited<ReturnType<typeof getDeviceStore>>,
    groupId: string,
    messages: readonly DisplayMessage[],
    newBytes?: ReadonlyMap<string, Uint8Array>
  ): Promise<void> {
    const list = mediaCacheRef.current.buildStored(groupId, messages, newBytes);
    return saverRef.current.enqueue(groupId, () => saveMessages(store, groupId, list));
  }
  // 昵称是异步从 IndexedDB 读的。读完之前不能判断"有没有设过"——否则老用户
  // 会被再弹一次设置页，违反"首次设置只出现一次"。
  const [profileLoaded, setProfileLoaded] = useState(false);
  // 首次设置昵称时，用户原本想做的事（加群/建群）先存这里，设置完再继续
  const pendingAfterProfileRef = useRef<(() => void) | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  // 备份恢复：解密后的 payload 暂存在这里，等用户在预览里确认后再合并。
  // 不放进 state，因为它可能很大，而且只有 handler 会读。
  const pendingRestoreRef = useRef<BackupPayload | null>(null);

  /**
   * 导出备份。
   * 从存储读，而不是从内存的 sessions 读——这样即使某个群当前没连上，
   * 也能把它的历史备份出去。C8 已把媒体 base64 落盘，所以这里拿到的
   * StoredMessage 自带媒体内容。
   */
  function handleExportBackup(password: string): Promise<string> {
    return exportBackup(nicknameRef.current, password);
  }

  /**
   * 解密备份并返回预览（不落盘）。
   * 解密后的 payload 暂存到 pendingRestoreRef，等用户确认后再由
   * handleConfirmRestore 执行合并。
   */
  async function handlePreviewRestore(
    text: string,
    password: string
  ): Promise<{ groups: number; messages: number; skipped: number }> {
    const { payload, preview } = await previewRestore(text, password);
    pendingRestoreRef.current = payload;
    return preview;
  }

  /**
   * 确认恢复：只添加本机没有的群和它们的消息，落盘，然后自动重连新群。
   *
   * 本机已有的群一律不动：它们的消息在内存会话里，写进存储的旧消息会在下一次保存时被覆盖；
   * 而且旧备份的密钥和 epoch 不能盖过本机的（见 chat-core mergeRestore）。
   * 写入走 saverRef 队列，和正常保存同一条顺序；写完把媒体告诉 C8 的 PersistedMediaCache，
   * 否则下一次保存会把刚恢复的图片和语音写成 undefined。
   */
  async function handleConfirmRestore(): Promise<void> {
    const payload = pendingRestoreRef.current;
    if (!payload) throw new Error(t("backup.nothingPending"));
    pendingRestoreRef.current = null;
    const store = await getDeviceStore();
    const existingGroups = await loadJoinedGroups(store);
    const merged = mergeRestore(existingGroups, {}, payload);
    await saveJoinedGroups(store, merged.groups);
    for (const groupId of merged.addedGroupIds) {
      const messages = merged.messagesByGroup[groupId] ?? [];
      await saverRef.current.enqueue(groupId, () => saveMessages(store, groupId, messages));
      mediaCacheRef.current.seed(groupId, messages);
    }
    // 昵称：只在备份里有、且本机还没设过时补上——不要覆盖用户当前的选择
    if (payload.nickname && !nicknameRef.current) {
      await saveNickname(payload.nickname);
      nicknameRef.current = payload.nickname;
      setNickname(payload.nickname);
    }
    setDisappearAfterByGroup(
      Object.fromEntries(merged.groups.map((g) => [g.groupId, g.disappearAfterMs ?? 0]))
    );
    // 自动重连恢复的群。恢复期间把 isAutoReconnectRef 设成 true，
    // 避免第一个群触发 shouldOpenChat 把用户从备份页拽到聊天页。
    const wasAutoReconnect = isAutoReconnectRef.current;
    isAutoReconnectRef.current = true;
    try {
      for (const g of merged.groups) {
        if (!merged.addedGroupIds.includes(g.groupId) || sessionsRef.current[g.groupId]) continue;
        try {
          await connectToGroup(parsedInviteFor(g), g.groupName);
        } catch {
          // 单个群连不上不影响其他群；用户可在消息列表里重试
        }
      }
    } finally {
      isAutoReconnectRef.current = wasAutoReconnect;
    }
  }

  // 每个群本地的「消息定时消失」时长（毫秒），0 表示关闭。
  // 只影响自己之后发出的消息；收到的消息按消息里带的 expiresInMs 处理。
  // 单独放一份镜像，是因为 GroupSettingsScreen 要立即显示新值，
  // 而 JoinedGroup 是异步读写加密存储的。
  const [disappearAfterByGroup, setDisappearAfterByGroup] = useState<Record<string, number>>({});

  // 每个群一个到期定时器。用 nextExpiryMs 算出下一条何时到期，
  // 到点再重排——不轮询。
  const expiryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /** 清掉某个群的到期定时器（离开群、卸载时用）。 */
  function clearExpiryTimer(groupId: string) {
    const timer = expiryTimersRef.current.get(groupId);
    if (timer !== undefined) {
      clearTimeout(timer);
      expiryTimersRef.current.delete(groupId);
    }
  }

  /** 按这个群当前最早的一条到期时间重排定时器。 */
  function scheduleExpiryFor(groupId: string) {
    clearExpiryTimer(groupId);
    const session = sessionsRef.current[groupId];
    if (!session) return;
    const next = nextExpiryMs(session.messages);
    if (next === undefined) return;
    // 最少 1 秒：到期时间已经在过去（时钟回拨等）时不要立刻疯狂重排
    const delay = Math.max(1000, next - Date.now());
    const timer = setTimeout(() => {
      void expireMessagesFor(groupId);
    }, delay);
    expiryTimersRef.current.set(groupId, timer);
  }

  /**
   * 把已经过期的消息从这个群里删掉、释放 objectUrl、落盘，然后为下一条重排。
   * 界面和加密存储里都要删——这是「阅后即焚」的实际执行点。
   */
  async function expireMessagesFor(groupId: string) {
    clearExpiryTimer(groupId);
    const session = sessionsRef.current[groupId];
    if (!session) return;
    const { keep, expired } = partitionExpired(session.messages, Date.now());
    if (expired.length === 0) {
      scheduleExpiryFor(groupId);
      return;
    }
    for (const m of expired) {
      if (m.media?.objectUrl) URL.revokeObjectURL(m.media.objectUrl);
    }
    setSessions((prev) => {
      const next = patchSession(prev, groupId, { messages: keep });
      sessionsRef.current = next;
      return next;
    });
    try {
      const store = await getDeviceStore();
      await saveGroupMessages(store, groupId, keep);
    } catch {
      // 落盘失败不影响界面上的删除；下次写入会覆盖
    }
    scheduleExpiryFor(groupId);
  }

  // 消息列表一变就按最新状态重排各群的到期定时器。直接在 setSessions 之后调用
  // scheduleExpiryFor 不够：更新函数要等下一次渲染才执行，那时 sessionsRef 还是旧的，
  // 新消息的到期时间就被漏掉了。
  useEffect(() => {
    sessionsRef.current = sessions;
    for (const groupId of Object.keys(sessions)) scheduleExpiryFor(groupId);
  }, [sessions]);

  // 组件卸载时把所有定时器清掉，避免在已卸载的组件上 setState
  useEffect(() => {
    return () => {
      for (const timer of expiryTimersRef.current.values()) clearTimeout(timer);
      expiryTimersRef.current.clear();
    };
  }, []);

  /**
   * 修改某个群的「消息定时消失」。
   * 保存到 JoinedGroup（本机、本群），并插一条本地系统提示——不发送给别人。
   */
  async function handleSetDisappearAfter(groupId: string, ms: number) {
    const store = await getDeviceStore();
    const groups = setDisappearAfter(await loadJoinedGroups(store), groupId, ms);
    await saveJoinedGroups(store, groups);
    setDisappearAfterByGroup((prev) => ({ ...prev, [groupId]: ms }));
    const session = sessionsRef.current[groupId];
    if (!session) return;
    await appendOwnMessage(groupId, {
      id: `sys-${nextMessageId++}`,
      isOwn: true,
      system: true,
      sentAtMs: Date.now(),
      text: ms > 0 ? t("disappear.turnedOn", { duration: disappearLabel(ms) }) : t("disappear.turnedOff"),
    });
  }

  useEffect(() => {
    void loadSavedRelayUrl().then((saved) => {
      if (saved) setRelayUrl(saved);
    });
    void loadNickname()
      .then((saved) => {
        nicknameRef.current = saved;
        setNickname(saved);
      })
      .finally(() => setProfileLoaded(true));

    // 启动时重连所有已加入的群。全部连上而不是只连一个——否则你在 A 群
    // 时 B 群来了消息不会知道。某个群连不上不影响其他群。
    void (async () => {
      const store = await getDeviceStore();
      const groups = await loadJoinedGroups(store);
      // 把各群的「消息定时消失」读进来，群设置页要立即显示当前值
      setDisappearAfterByGroup(
        Object.fromEntries(groups.map((g) => [g.groupId, g.disappearAfterMs ?? 0]))
      );
      isAutoReconnectRef.current = true;
      for (const g of groups) {
        try {
          await connectToGroup(parsedInviteFor(g), g.groupName);
        } catch {
          // 这个群连不上就跳过，继续连下一个
        }
      }
      isAutoReconnectRef.current = false;
    })();
  }, []);
  // 信令回调是在 connectToGroup 里一次性注册的闭包，拿不到最新的 screen——
  // 用 ref 让它们能读到当前通话状态，避免闭包捕获旧值这个经典坑。
  const currentCallRef = useRef<ActiveCall | undefined>(undefined);
  currentCallRef.current = screen.name === "connected" ? screen.call : undefined;

  /**
   * 派生群密钥、连上 relay——加入邀请码流程和创建群聊流程最终都要做同一件事，
   * 抽成一个函数，不要在两个地方各写一份容易走歪的版本。订阅 onMessage 也在
   * 这里做一次，不放在 ChatScreen 里——ChatScreen 会被卸载/重新挂载（切到消息
   * 列表再切回来），但这个订阅只应该建立一次，跟连接本身的生命周期绑定。
   */
  /**
   * @param keepScreen 轮换密钥时用——重连不该把管理员从发布页拽走，
   *   否则他看不到刚生成的新邀请码。
   */
  async function connectToGroup(parsed: ParsedInvite, groupName: string, keepScreen = false): Promise<void> {
    const store = await getDeviceStore();
    const { epochKey, groupId, epoch } = await joinGroupFromInvite(parsed, store);
    const identity = await getDeviceIdentity();
    myDeviceIdRef.current = identity.deviceId;

    const client = new RelayClient(relayUrl, {
      deviceId: identity.deviceId,
      groupId,
      keystore: identity.keystore,
      keystoreAlias: identity.keystoreAlias,
      groupKey: epochKey,
      epoch,
    });
    try {
      await client.connect("register");
    } catch (err) {
      if (err instanceof Error && err.message.includes("already registered")) {
        await client.connect("authenticate");
      } else {
        throw err;
      }
    }

    const assembler = new FileAssembler();

    // 每次消息列表变化就整体落盘。条数有上限（见 messageStore），所以这个
    // 写入量是有界的；比起为每条消息单独维护增量写，整体写简单且不会写歪。
    // 每个群各自落盘到自己的 key。闭包捕获了 groupId，所以每条连接的
    // 回调都会写到正确的群，不会串。
    const persist = (messages: DisplayMessage[], mediaBytesById?: Map<string, Uint8Array>) => {
      void saveGroupMessages(store, groupId, messages, mediaBytesById);
    };

    /** 更新这个群的会话状态——不影响其他群 */
    const patch = (p: Partial<GroupSession>) => {
      setSessions((prev) => {
        const next = patchSession(prev, groupId, p);
        sessionsRef.current = next;
        return next;
      });
    };

    /** 往这个群追加消息并落盘 */
    const appendMessage = (message: DisplayMessage, mediaBytes?: Uint8Array) => {
      setSessions((prev) => {
        const session = prev[groupId];
        if (!session) return prev;
        const messages = [...session.messages, message];
        persist(messages, mediaBytes ? new Map([[message.id, mediaBytes]]) : undefined);
        const next = patchSession(prev, groupId, { messages });
        sessionsRef.current = next;
        return next;
      });
      // 新消息可能带到期时间，重排这个群的定时器
      scheduleExpiryFor(groupId);
    };

    // 重启后重新加载历史：已经过期的消息不该再出现，立即从存储里删掉。
    const storedHistory = await loadMessages(store, groupId);
    const { keep: keptStored, expired: expiredStored } = partitionExpired(storedHistory, Date.now());
    // 记住已经落盘的媒体内容，之后的整体保存才不会把它们写丢（C8）
    mediaCacheRef.current.seed(groupId, keptStored);
    if (expiredStored.length > 0) {
      void saverRef.current.enqueue(groupId, () => saveMessages(store, groupId, keptStored));
    }
    const history = keptStored.map(fromStored);
    const knownDevices = await loadKnownDevices(store, groupId);

    client.onMessage((msg) => {
      const env = msg.envelope;

      if (env.kind === "text") {
        // 发消息的人带了昵称，正好补进设备名单
        void recordSightings(groupId, [{ deviceId: msg.fromDeviceId, displayName: env.senderName }]);

        const textReceivedAtMs = Date.now();
        const textExpiresAtMs = expiresAtFor(
          textReceivedAtMs,
          sanitizeExpiresInMs(env.expiresInMs)
        );
        appendMessage({
          id: `recv-${nextMessageId++}`,
          text: env.text,
          isOwn: false,
          fromDeviceId: displayNameFor(env.senderName, msg.fromDeviceId),
          // 用发送方带过来的时间，不是本机收到的时间——离线补发的消息
          // 应该显示当初发出的时刻
          sentAtMs: env.sentAtMs,
          ...(env.replyTo ? { replyTo: env.replyTo } : {}),
          ...(textExpiresAtMs !== undefined ? { expiresAtMs: textExpiresAtMs } : {}),
        });
        return;
      }

      if (env.kind === "announcement") {
        const category: AnnouncementCategory = env.category ?? "notice";

        // 验签：没有管理员公钥、没有签名、或者验不过，都不当公告。
        // 这是"管理员"真正生效的地方——本地解锁界面骗不过别人的客户端。
        void (async () => {
          const adminPublicKey = parsed.adminPublicKeyRawB64Url;
          if (!adminPublicKey || !env.adminSignature) return;
          const ok = await verifyAnnouncement(adminPublicKey, env.adminSignature, {
            groupId,
            category,
            title: env.title,
            body: env.body,
            sentAtMs: env.sentAtMs,
            audioFileId: env.audioFileId,
          });
          if (!ok) return;

          // 音频可能还在传输中（分片先到或后到都有可能）——先记下引用，
          // 等文件组装完再补上播放地址
          if (env.audioFileId) pendingAudioRef.current.set(env.audioFileId, category);
          const readyUrl = env.audioFileId ? arrivedAudioRef.current.get(env.audioFileId) : undefined;

          setSessions((prev) => {
            const s = prev[groupId];
            if (!s) return prev;
            return patchSession(prev, groupId, {
              today: {
                ...s.today,
                [category]: {
                  title: env.title,
                  body: env.body,
                  audioUrl: readyUrl,
                  audioPending: env.audioFileId && !readyUrl ? t("today.audioReceiving") : undefined,
                },
              },
            });
          });
        })();
        return;
      }

      if (env.kind === "file-meta") {
        assembler.acceptMeta(env);
        patch({ incomingProgress: assembler.progress() });
        return;
      }

      // file-chunk：集齐了就组装成一条媒体消息
      const done = assembler.acceptChunk(env);
      if (!done) {
        patch({ incomingProgress: assembler.progress() });
        return;
      }
      const objectUrl = URL.createObjectURL(new Blob([done.bytes as BlobPart], { type: done.mimeType }));
      patch({ incomingProgress: assembler.progress() });

      // 公告配的音频不进聊天记录——它属于「今日」的栏目
      arrivedAudioRef.current.set(done.fileId, objectUrl);
      const pendingCategory = pendingAudioRef.current.get(done.fileId);
      if (pendingCategory) {
        pendingAudioRef.current.delete(done.fileId);
        setSessions((prev) => {
          const s = prev[groupId];
          if (!s) return prev;
          const existing = s.today[pendingCategory];
          if (!existing) return prev;
          return patchSession(prev, groupId, {
            today: {
              ...s.today,
              [pendingCategory]: { ...existing, audioUrl: objectUrl, audioPending: undefined },
            },
          });
        });
        return;
      }
      const fileReceivedAtMs = Date.now();
      const fileExpiresAtMs = expiresAtFor(
        fileReceivedAtMs,
        sanitizeExpiresInMs(done.expiresInMs)
      );
      appendMessage(
        {
          id: `recv-${nextMessageId++}`,
          isOwn: false,
          fromDeviceId: displayNameFor(done.senderName, msg.fromDeviceId),
          sentAtMs: Date.now(),
          media: {
            mediaKind: done.mediaKind,
            fileName: done.fileName,
            mimeType: done.mimeType,
            objectUrl,
            sizeBytes: done.bytes.byteLength,
            ...(done.durationMs !== undefined ? { durationMs: done.durationMs } : {}),
          },
          ...(fileExpiresAtMs !== undefined ? { expiresAtMs: fileExpiresAtMs } : {}),
        },
        done.bytes
      );
    });

    // 通话工厂。之前只声明了 callFactoryRef 却从来没赋值过，
    // 所以 handleStartCall 每次都在第一行静默返回——按钮点了什么都不发生。
    callFactoryRef.current = (callId, peerDeviceId, kind) =>
      new CallSession({
        callId,
        peerDeviceId,
        kind,
        iceServers: ICE_CONFIG.iceServers,
        iceTransportPolicy: ICE_CONFIG.iceTransportPolicy,
        // RelayClient 本身就有同名的 sendSignaling，直接当传输层用
        transport: client,
        onStateChange: (info) =>
          setScreen((prev) =>
            prev.name === "connected" && prev.call
              ? { ...prev, call: { ...prev.call, info } }
              : prev
          ),
        onLocalStream: (stream) =>
          setScreen((prev) =>
            prev.name === "connected" && prev.call
              ? { ...prev, call: { ...prev.call, localStream: stream } }
              : prev
          ),
        onRemoteStream: (stream) =>
          setScreen((prev) =>
            prev.name === "connected" && prev.call
              ? { ...prev, call: { ...prev.call, remoteStream: stream } }
              : prev
          ),
      });

    // 收到对方的信令。之前完全没订阅，所以别人打过来这边毫无反应——
    // 通话是"两边都没接上"，不只是发不出去。
    client.onSignaling((signal) => {
      const currentCall = currentCallRef.current;

      if (signal.type === "call_invite") {
        // 已经在通话中就直接拒掉，不要把现有通话顶掉
        if (currentCall) {
          void client.sendSignaling("call_reject", signal.fromDeviceId, signal.callId, {
            reason: "busy",
          });
          return;
        }
        const factory = callFactoryRef.current;
        if (!factory) return;
        const kind = (signal.payload["kind"] as CallKind | undefined) ?? "voice";
        const session = factory(signal.callId, signal.fromDeviceId, kind);
        setScreen((prev) =>
          prev.name === "connected"
            ? { ...prev, call: { session, kind, info: { state: "idle" }, peerDeviceId: signal.fromDeviceId } }
            : prev
        );
        void session.receiveInvite(String(signal.payload["sdp"] ?? ""));
        return;
      }

      if (!currentCall) return;

      // 其余信令按类型分派给当前通话
      if (signal.type === "call_answer") {
        void currentCall.session.receiveAnswer(String(signal.payload["sdp"] ?? ""));
      } else if (signal.type === "ice_candidate") {
        void currentCall.session.receiveIceCandidate(
          signal.payload["candidate"] as RTCIceCandidateInit
        );
      } else if (signal.type === "call_reject" || signal.type === "call_cancel" || signal.type === "call_hangup") {
        void currentCall.session.hangup();
      }
    });

    client.onConference((frame) =>
      handleConferenceFrame(frame, client, sessionsRef.current[groupId]?.knownDevices ?? [])
    );

    client.onPeersChange((onlinePeers) => {
      patch({ onlinePeers });
      // 在线状态是唯一能"看见还没说过话的成员"的途径
      void recordSightings(groupId, onlinePeers.map((id) => ({ deviceId: id })));
    });
    client.onStatusChange((connectionStatus) => {
      patch({ connectionStatus });
      if (connectionStatus === "reconnecting") {
        setDisconnects((prev) => recordDisconnect(prev, Date.now()));
      } else if (connectionStatus === "connected") {
        setDisconnects((prev) => recordReconnect(prev, Date.now()));
      }
    });
    client.onLatency((rttMs) => setLatency((prev) => addLatencySample(prev, rttMs)));
    client.onQueueChange((pendingCount) => patch({ pendingCount }));

    const session: GroupSession = {
      groupId,
      groupName,
      client,
      messages: history,
      connectionStatus: client.connectionStatus,
      pendingCount: client.pendingMessageCount,
      onlinePeers: client.onlinePeers,
      adminPublicKey: parsed.adminPublicKeyRawB64Url,
      epoch,
      today: {},
      knownDevices,
      lastReadAtMs: Date.now(),
    };

    // 记住这个群，下次启动自动重连
    const groups = upsertGroup(await loadJoinedGroups(store), {
      groupId,
      groupName,
      keyMaterialB64Url: parsed.keyMaterialB64Url,
      epoch,
      ...(parsed.adminPublicKeyRawB64Url
        ? { adminPublicKeyRawB64Url: parsed.adminPublicKeyRawB64Url }
        : {}),
      joinedAtMs: Date.now(),
      lastReadAtMs: Date.now(),
    });
    await saveJoinedGroups(store, groups);

    // 是不是第一个群，要在调用 setSessions 之前判断——不能把 setScreen 放进
    // updater 里，React 会重复调用 updater，在里面做副作用不可靠。
    const isFirstGroup = Object.keys(sessionsRef.current).length === 0;
    // 启动时自动重连不该抢走界面——只有用户主动加入才跳进聊天
    const shouldOpenChat = isFirstGroup && !isAutoReconnectRef.current;
    sessionsRef.current = { ...sessionsRef.current, [groupId]: session };
    setSessions(sessionsRef.current);
    // 历史里可能还有即将到期的消息，连上后马上排一次
    scheduleExpiryFor(groupId);

    if (keepScreen) {
      // 保持当前界面不动
    } else if (shouldOpenChat) {
      // 唯一一个群时直接进聊天——小团体绝大多数只有一个群，先显示一个只有
      // 一行的列表再让用户点一下，那一下是白点的。从聊天页"返回"仍能看到列表，
      // 所以加入别的群的入口没有丢。
      setScreen({ name: "connected", activeGroupId: groupId, view: "chat", deviceId: identity.deviceId });
    } else {
      setScreen((s) =>
        s.name === "connected" ? s : { name: "connected", activeGroupId: null, view: "list", deviceId: identity.deviceId }
      );
    }
  }

  /** 还没设昵称就先去设置，设完自动继续原来的动作——不打断用户的意图 */
  function requireProfile(next: () => void): boolean {
    if (nicknameRef.current) return false;
    pendingAfterProfileRef.current = next;
    setNeedsProfile(true);
    return true;
  }

  async function handleProfileDone(name: string) {
    await saveNickname(name);
    nicknameRef.current = name;
    setNickname(name);
    setNeedsProfile(false);
    const next = pendingAfterProfileRef.current;
    pendingAfterProfileRef.current = null;
    next?.();
  }

  function handleSubmitInviteCode(raw: string) {
    if (requireProfile(() => handleSubmitInviteCode(raw))) return;
    try {
      const parsed = parseInviteAuto(raw);
      // 解析成功只证明"邀请串格式和有效期本身没问题"，群名、邀请人这些元数据
      // 不在邀请串里，真实产品里要另外问服务器要——这里先用占位内容展示，
      // 明确不是真实数据。真正要用于密钥派生的 parsed（groupId/keyMaterial/epoch）
      // 是真实的解析结果，不是占位。
      // 群名现在真的来自邀请串（创建者写进去的），不再是占位数据。
      // 成员数和邀请人还拿不到——中继是盲的，不知道群里有谁、谁邀请的谁，
      // 所以这两项暂时不显示，而不是编一个假的出来。
      const invite: InviteInfo = {
        status: "valid",
        groupName: parsed.groupName ?? t("invite.defaultGroupName"),
        inviterName: undefined,
        expiryLabel: parsed.expiresAtMs ? formatExpiry(parsed.expiresAtMs) : undefined,
      };
      setScreen({ name: "invite", invite, parsed, isConfirming: false });
    } catch (err) {
      const reason = err instanceof InviteParseError ? mapParseErrorReason(err.reason) : "malformed";
      setScreen({ name: "invite", invite: { status: "invalid", reason }, isConfirming: false });
    }
  }

  async function handleConfirmJoin() {
    if (screen.name !== "invite" || !screen.parsed) return;
    const parsed = screen.parsed;
    setScreen({ ...screen, isConfirming: true, errorMessage: undefined });

    try {
      const groupName = screen.invite.status === "valid" ? screen.invite.groupName : t("app.name");
      await connectToGroup(parsed, groupName);
    } catch (err) {
      const message =
        err instanceof MissingGroupIdError
          ? t("invite.legacyUnsupported")
          : t("invite.joinFailed", { reason: err instanceof Error ? err.message : t("common.pleaseRetry") });
      setScreen((prev) =>
        prev.name === "invite" ? { ...prev, isConfirming: false, errorMessage: message } : prev
      );
    }
  }

  async function handleGroupCreated(input: {
    groupId: string;
    groupName: string;
    keyMaterialB64Url: string;
    inviteCode: string;
    adminRecoveryCode: string;
  }) {
    const parsed = parseInviteAuto(input.inviteCode); // 复用解析路径，不手搓一份 ParsedInvite

    // 先进群，再存管理员凭据。反过来的话，存凭据一旦失败就整个卡在建群这一步——
    // 真机上就是这么断的。存失败最多是发不了公告，可以用恢复码补救，
    // 但连不进自己刚建的群是彻底走不下去。
    await connectToGroup(parsed, input.groupName);
    try {
      await saveAdminKey(input.groupId, input.adminRecoveryCode);
      // 存完立刻重新判断——否则要等到下一次 sessions 变化，
      // 建群者会看不到自己的发布入口
      setHoldsAdminKey(true);
    } catch {
      // 忽略：群已经能用了，管理员权限可以用恢复码恢复
    }
  }

  /** 当前打开的群的会话；不在群里就是 undefined */
  function activeSession(): GroupSession | undefined {
    if (screen.name !== "connected" || !screen.activeGroupId) return undefined;
    return sessions[screen.activeGroupId];
  }

  /** 往当前群追加一条自己发的消息并落盘 */
  async function appendOwnMessage(groupId: string, message: DisplayMessage, mediaBytes?: Uint8Array) {
    const store = await getDeviceStore();
    setSessions((prev) => {
      const session = prev[groupId];
      if (!session) return prev;
      const messages = [...session.messages, message];
      void saveGroupMessages(store, groupId, messages, mediaBytes ? new Map([[message.id, mediaBytes]]) : undefined);
      const next = patchSession(prev, groupId, { messages });
      sessionsRef.current = next;
      return next;
    });
    // 自己发的消息也可能带到期时间（定时消失开着时），同样要排定时器
    if (message.expiresAtMs !== undefined) scheduleExpiryFor(groupId);
  }

  function handleCopyMessage(message: DisplayMessage) {
    if (!message.text) return;
    void copyToClipboard(message.text);
  }

  /** 删除只影响本机——中继不存消息，也没有"撤回"这种协议动作 */
  async function handleDeleteMessage(messageId: string) {
    const session = activeSession();
    if (!session) return;
    const store = await getDeviceStore();
    setSessions((prev) => {
      const s = prev[session.groupId];
      if (!s) return prev;
      const messages = s.messages.filter((m) => m.id !== messageId);
      void saveGroupMessages(store, session.groupId, messages);
      return patchSession(prev, session.groupId, { messages });
    });
  }

  async function handleSendMessage(text: string) {
    const session = activeSession();
    if (!session) return;
    const { groupId, client } = session;
    setSessions((prev) => patchSession(prev, groupId, { sendError: undefined }));

    // 在 try 外面算好——发送失败时要把它一起保留在"未发送"的那条上，
    // 否则重发会丢掉引用
    const reply = replyTarget
        ? {
            senderName: replyTarget.isOwn ? (nickname ?? t("common.me")) : (replyTarget.fromDeviceId ?? t("common.otherPerson")),
            excerpt: buildReplyExcerpt({
              id: replyTarget.id,
              text: replyTarget.text,
              media: replyTarget.media ? { fileName: replyTarget.media.fileName } : undefined,
              sentAtMs: replyTarget.sentAtMs,
            }),
          }
        : undefined;

    try {
      // sendText 断线时会排队而不是抛错——排队也算"发出去了"，
      // 连接状态横幅会告诉用户还有几条在等待
      // 入队时就开始计时：用户看到的就是"我发出的那一刻"，
      // 断线排队不该让消失时间往后拖。
      const sentAtMs = Date.now();
      const disappearMs = disappearAfterByGroup[groupId] ?? 0;
      const expiresInMs = sanitizeExpiresInMs(disappearMs);
      const outcome = await client.sendEnvelope({
        kind: "text",
        id: randomUUID(),
        text,
        sentAtMs,
        ...(nickname ? { senderName: nickname } : {}),
        ...(reply ? { replyTo: reply } : {}),
        ...(expiresInMs !== undefined ? { expiresInMs } : {}),
      });
      setReplyTarget(null);
      await appendOwnMessage(groupId, {
        id: `sent-${nextMessageId++}`,
        text,
        // 断线时消息进了队列，会在重连后自动补发——标出来让用户知道
        // 它还没真的发出去，而不是让他以为对方已经看到了
        queued: outcome === "queued",
        isOwn: true,
        sentAtMs,
        ...(reply ? { replyTo: reply } : {}),
        ...(expiresInMs !== undefined ? { expiresAtMs: sentAtMs + expiresInMs } : {}),
      });
    } catch {
      // sendEnvelope 断线时会排队而不是抛错，所以走到这里说明是加密或
      // 序列化出了问题——那不是重发能解决的，如实报错。
      setSessions((prev) => patchSession(prev, groupId, { sendError: t("chat.sendFailedRetry") }));
    }
  }

  async function handleSendFile(
    file: File,
    mediaKind: "image" | "voice" | "file",
    extra?: { durationMs?: number }
  ) {
    const session = activeSession();
    if (!session) return;
    const { groupId, client } = session;
    setSessions((prev) => patchSession(prev, groupId, { sendError: undefined }));

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileId = randomUUID();
      const fileDisappearMs = disappearAfterByGroup[groupId] ?? 0;
      const fileExpiresInMs = sanitizeExpiresInMs(fileDisappearMs);
      const { meta, chunks } = buildFileEnvelopes({
        fileId,
        ...(nickname ? { senderName: nickname } : {}),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        mediaKind,
        bytes,
        ...(extra?.durationMs !== undefined ? { durationMs: extra.durationMs } : {}),
        ...(fileExpiresInMs !== undefined ? { expiresInMs: fileExpiresInMs } : {}),
      });

      // meta 必须先到，接收方才知道总共有多少片。
      // 大文件要好几秒，没有进度显示发送方会以为卡住了。
      await sendFileEnvelopes(
        { fileName: file.name },
        meta,
        chunks,
        (env) => client.sendEnvelope(env as Parameters<typeof client.sendEnvelope>[0]),
        {
          onProgress: (p) =>
            setSessions((prev) => patchSession(prev, groupId, { sendProgress: sendProgressText(p) })),
        }
      );
      setSessions((prev) => patchSession(prev, groupId, { sendProgress: undefined }));

      // 自己发的媒体本地直接显示（中继不会把自己发的消息转发回来）
      await appendOwnMessage(
        groupId,
        {
          id: `sent-${nextMessageId++}`,
          isOwn: true,
          sentAtMs: Date.now(),
          media: {
            mediaKind,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            objectUrl: URL.createObjectURL(file),
            sizeBytes: bytes.byteLength,
            ...(extra?.durationMs !== undefined ? { durationMs: extra.durationMs } : {}),
          },
          ...(fileExpiresInMs !== undefined
            ? { expiresAtMs: Date.now() + fileExpiresInMs }
            : {}),
        },
        bytes
      );
    } catch {
      setSessions((prev) => patchSession(prev, groupId, { sendError: t("chat.sendFailedConnection") }));
    }
  }

  async function handlePublishAnnouncement(
    category: AnnouncementCategory,
    title: string,
    body: string,
    audioFile?: File | undefined
  ) {
    const session = activeSession() ?? sortSessions(sessions)[0];
    if (!session) return;

    // 只有持有这个群管理员私钥的设备才能签发公告。没有私钥就发不出去——
    // 本地解锁界面不构成权限。
    const adminKey = await loadAdminKey(session.groupId);
    if (!adminKey) throw new Error(t("admin.noKeyForGroup"));

    // 音频走已有的分片加密传输，公告只带一个引用——公告帧不适合塞几 MB
    let audioFileId: string | undefined;
    if (audioFile) {
      audioFileId = randomUUID();
      const bytes = new Uint8Array(await audioFile.arrayBuffer());
      const { meta, chunks } = buildFileEnvelopes({
        fileId: audioFileId,
        fileName: audioFile.name,
        mimeType: audioFile.type || "audio/mpeg",
        mediaKind: "voice",
        bytes,
      });
      await sendFileEnvelopes(
        { fileName: audioFile.name },
        meta,
        chunks,
        (env) => session.client.sendEnvelope(env as Parameters<typeof session.client.sendEnvelope>[0]),
        { onProgress: (p) => setPublishProgress(sendProgressText(p)) }
      );
      setPublishProgress(null);
      // 本机也要能播——不然发布者自己看不到播放器
      const localUrl = URL.createObjectURL(audioFile);
      setSessions((prev) => {
        const s = prev[session.groupId];
        if (!s) return prev;
        const existing = s.today[category];
        return patchSession(prev, session.groupId, {
          today: { ...s.today, [category]: { title, body, ...existing, audioUrl: localUrl } },
        });
      });
    }

    const sentAtMs = Date.now();
    const adminSignature = await signAnnouncement(adminKey, {
      groupId: session.groupId,
      category,
      title,
      body,
      sentAtMs,
      audioFileId,
    });

    await session.client.sendEnvelope({
      kind: "announcement",
      id: randomUUID(),
      category,
      title,
      body,
      sentAtMs,
      adminSignature,
      ...(audioFileId ? { audioFileId } : {}),
      ...(nickname ? { senderName: nickname } : {}),
    });
    setSessions((prev) => {
      const s = prev[session.groupId];
      if (!s) return prev;
      const existing = s.today[category];
      return patchSession(prev, session.groupId, {
        today: { ...s.today, [category]: { title, body, audioUrl: existing?.audioUrl } },
      });
    });
  }

  /** 发起会议：广播邀请，群里在线的人会收到 */
  function handleStartConference() {
    const session = activeSession();
    if (session) startConference(session.client);
  }

  /**
   * 记录见到的设备。
   *
   * 这里必须串行：读取名单 → 更新 → 写回是个读改写序列，上线和下线事件
   * 连着来的时候，后一个会读到前一个还没写完的旧值，把刚记下的设备丢掉。
   * 每个群一条 promise 链，保证顺序。
   */
  async function recordSightings(
    groupId: string,
    sightings: { deviceId: string; displayName?: string | undefined }[]
  ): Promise<void> {
    const previous = deviceWriteChainRef.current.get(groupId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const store = await getDeviceStore();
        let devices = await loadKnownDevices(store, groupId);
        const now = Date.now();
        for (const s of sightings) devices = markDeviceSeen(devices, s.deviceId, now, s.displayName);
        await saveKnownDevices(store, groupId, devices);
        setSessions((prev) => patchSession(prev, groupId, { knownDevices: devices }));
      });
    deviceWriteChainRef.current.set(groupId, next);
    return next;
  }

  /**
   * 更换群密钥。生成新的密钥材料、epoch 加一，返回新邀请码给管理员分发。
   * 本机随即用新密钥重连——不然管理员自己反而读不到轮换后的消息。
   */
  async function handleRotateKey(): Promise<string> {
    const session = activeSession() ?? sortSessions(sessions)[0];
    if (!session) throw new Error(t("admin.noGroupToRotate"));

    const rotated = rotateGroupKey({
      groupId: session.groupId,
      groupName: session.groupName,
      currentEpoch: session.epoch,
      adminPublicKeyRawB64Url: session.adminPublicKey,
      serverJoinCode: randomUUID().slice(0, 8).toUpperCase(),
    });

    // 旧连接用的是旧密钥，必须断掉重连
    session.client.close();
    // 轮换之后旧设备读不到新消息了，名单重新积累
    await saveKnownDevices(await getDeviceStore(), session.groupId, forgetAllDevices());
    await connectToGroup(parseInviteAuto(rotated.inviteCode), session.groupName, true);
    return rotated.inviteCode;
  }

  async function handleRenameGroup(groupId: string, groupName: string): Promise<void> {
    const store = await getDeviceStore();
    await saveJoinedGroups(store, renameGroup(await loadJoinedGroups(store), groupId, groupName));
    setSessions((prev) => patchSession(prev, groupId, { groupName }));
  }

  /**
   * 退群：断连接、删本机记录。中继不保存任何东西，所以"退群"就是本机的事——
   * 没有需要通知服务端的状态。留下的人不会收到任何提示，这一点在界面上说了。
   */
  async function handleLeaveGroup(groupId: string): Promise<void> {
    clearExpiryTimer(groupId);
    const leaving = sessions[groupId];
    if (leaving) {
      for (const m of leaving.messages) {
        if (m.media?.objectUrl) URL.revokeObjectURL(m.media.objectUrl);
      }
    }
    sessions[groupId]?.client.close();

    const store = await getDeviceStore();
    await saveJoinedGroups(store, removeGroup(await loadJoinedGroups(store), groupId));
    mediaCacheRef.current.forget(groupId);
    await saverRef.current.enqueue(groupId, () => clearMessages(store, groupId));
    await saveKnownDevices(store, groupId, []);
    setDisappearAfterByGroup((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });

    setSessions((prev) => {
      const next = { ...prev };
      delete next[groupId];
      sessionsRef.current = next;
      return next;
    });
    setScreen(LIST_SCREEN);
  }

  /** 各群的今日内容合并显示——小团体通常只有一个群，多群时后加入的覆盖先加入的 */
  function mergedToday(): TodayContent {
    return sortSessions(sessions).reduce<TodayContent>((acc, s) => ({ ...acc, ...s.today }), {});
  }

  async function handleStartCall(kind: CallKind, peerDeviceId: string) {
    if (screen.name !== "connected" || !callFactoryRef.current) return;
    const callId = randomUUID();
    const session = callFactoryRef.current(callId, peerDeviceId, kind);
    setScreen({ ...screen, call: { session, kind, info: { state: "idle" }, peerDeviceId } });
    await session.startOutgoing();
  }

  function handleDismissCall() {
    setScreen((prev) => (prev.name === "connected" ? { ...prev, call: undefined } : prev));
  }

  if (!isSecureContextAvailable()) {
    return <InsecureContextNotice />;
  }

  // 能力自检最先——地基不行的话，后面每一步都会以看不懂的方式失败
  if (capability && !capability.ok) {
    return <CapabilityProblemScreen reason={capability.reason} detail={capability.detail} />;
  }

  // 应用锁在最前面——手机被别人拿到时，连群名都不该看到
  if (locked === null) {
    return <BusyScreen />;
  }
  if (locked) {
    return (
      <LockScreen
        mode="unlock"
        onUnlocked={() => setLocked(false)}
        onAttemptsExhausted={() => {
          // 次数用尽就清空本机数据。中继不存任何内容，所以这里删掉就是真的没了。
          setLockEnabledState(false);
          setBiometricEnabled(false);
          void (async () => {
            await disableLock();
            indexedDB.deleteDatabase("secureinchat-storage");
            indexedDB.deleteDatabase("secureinchat-keystore");
            indexedDB.deleteDatabase("secureinchat-master-key");
            indexedDB.deleteDatabase("secureinchat-admin-keys");
          })();
        }}
        biometricEnabled={biometricSupported && biometricEnabled}
        onBiometricUnlock={biometricSupported ? authenticateBiometric : undefined}
      />
    );
  }
  if (keyProblem) {
    return (
      <KeyUnavailableScreen
        kind={keyProblem.kind}
        detail={keyProblem.message}
        onRetry={async () => {
          // 重试成功：其余启动步骤之前读存储失败了，重新加载一次最简单可靠
          if (await probeMasterKey()) window.location.reload();
        }}
        onResetAndRestore={async () => {
          await resetLocalEncryptedData();
          await probeMasterKey();
          setScreen({ name: "backup" });
        }}
      />
    );
  }
  if (showLockSetup) {
    return (
      <LockScreen
        mode="setup"
        onUnlocked={() => {
          setShowLockSetup(false);
          setLockEnabledState(true);
        }}
        onCancel={() => setShowLockSetup(false)}
      />
    );
  }

  // 昵称是异步从 IndexedDB 读的。读完之前不渲染主界面——否则会出现竞态：
  // 读得慢时老用户被重复要求设昵称，或者新用户点得快就绕过了设置。
  // 这一步通常是几十毫秒，用户几乎察觉不到。
  if (!profileLoaded) {
    return <BusyScreen />;
  }

  if (needsProfile) {
    return <ProfileSetupScreen onDone={handleProfileDone} />;
  }

  if (screen.name === "join") {
    return (
      <JoinGroupScreen
        onSubmitInviteCode={handleSubmitInviteCode}
        onCreateGroup={() => {
          const go = () => setScreen({ name: "createGroup" });
          if (!requireProfile(go)) go();
        }}
        onScanQr={() => {
          const go = () => setScreen({ name: "scanQr" });
          if (!requireProfile(go)) go();
        }}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "serverSettings") {
    return (
      <ServerSettingsScreen
        defaultUrl={RELAY_URL}
        onSaved={(url) => setRelayUrl(url)}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "adminPublish") {
    return (
      <AdminPublishScreen
        content={mergedToday()}
        onPublish={handlePublishAnnouncement}
        onRotateKey={handleRotateKey}
        progress={publishProgress}
        onLockAdmin={() => {
          void setAdminUnlocked(false);
          setIsAdmin(false);
          setScreen(LIST_SCREEN);
        }}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "editProfile") {
    return (
      <EditProfileScreen
        currentNickname={nickname ?? ""}
        onSaved={(name) => {
          nicknameRef.current = name;
          setNickname(name);
          setScreen(LIST_SCREEN);
        }}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "groupSettings") {
    const s = sessions[screen.groupId];
    if (!s) {
      return <BusyScreen />;
    }
    return (
      <GroupSettingsScreen
        groupName={s.groupName}
        memberCount={s.onlinePeers.length}
        onRename={(name) => handleRenameGroup(s.groupId, name)}
        onLeave={() => handleLeaveGroup(s.groupId)}
        onShowInvite={
          groupSettingsAdminAvailable
            ? () => setScreen({ name: "groupInvite", groupId: s.groupId, from: screen.name === "groupSettings" ? screen.from : "chat" })
            : undefined
        }
        disappearAfterMs={disappearAfterByGroup[s.groupId] ?? 0}
        onSetDisappearAfter={(ms) => void handleSetDisappearAfter(s.groupId, ms)}
        onBack={() =>
          // 从哪儿进来就回哪儿——从列表长按进来的，返回不该跳进聊天页
          setScreen(
            screen.name === "groupSettings" && screen.from === "list"
              ? LIST_SCREEN
              : { name: "connected", activeGroupId: s.groupId, view: "chat", deviceId: "" }
          )
        }
      />
    );
  }

  if (screen.name === "groupInvite") {
    const groupName = groupInviteState.status === "ready" ? groupInviteState.groupName : undefined;
    const inviteCode = groupInviteState.status === "ready" ? groupInviteState.inviteCode : undefined;
    const errorMessage = groupInviteState.status === "error" ? groupInviteState.message : undefined;
    return (
      <GroupInviteScreen
        {...(groupName !== undefined ? { groupName } : {})}
        {...(inviteCode !== undefined ? { inviteCode } : {})}
        {...(errorMessage !== undefined ? { error: errorMessage } : {})}
        onCopy={() => {
          if (inviteCode) void copyToClipboard(inviteCode);
        }}
        // 回到群设置，并带回当初进入群设置的来源，返回键的行为保持一致
        onBack={() => setScreen({ name: "groupSettings", groupId: screen.groupId, from: screen.from })}
      />
    );
  }

  if (screen.name === "backup") {
    return (
      <BackupScreen
        onBack={() => setScreen(LIST_SCREEN)}
        onExport={handleExportBackup}
        onPreviewRestore={handlePreviewRestore}
        onConfirmRestore={handleConfirmRestore}
      />
    );
  }

  if (screen.name === "devices") {
    const s = activeSession() ?? sortSessions(sessions)[0];
    return (
      <ConnectedDevicesScreen
        groupName={s?.groupName ?? ""}
        devices={s?.knownDevices ?? []}
        onlineNow={s?.onlinePeers ?? []}
        myDeviceId={screen.name === "devices" ? myDeviceIdRef.current : ""}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "diagnostics") {
    return (
      <ConnectionDiagnosticsScreen
        relayUrl={relayUrl}
        iceConfig={ICE_CONFIG}
        status={sortSessions(sessions)[0]?.connectionStatus ?? "disconnected"}
        latency={latency}
        disconnects={disconnects}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "adminRecovery") {
    return (
      <AdminRecoveryScreen
        groups={sortSessions(sessions).map((s) => ({
          groupId: s.groupId,
          groupName: s.groupName,
          adminPublicKey: s.adminPublicKey,
        }))}
        onRecovered={() => {
          setHoldsAdminKey(true);
          setIsAdmin(true);
          void setAdminUnlocked(true);
          setScreen(LIST_SCREEN);
        }}
        onBack={() => setScreen(LIST_SCREEN)}
      />
    );
  }

  if (screen.name === "scanQr") {
    return (
      <QrScanScreen
        onScanned={(text) => handleSubmitInviteCode(text)}
        onBack={() => setScreen({ name: "join" })}
      />
    );
  }

  if (screen.name === "createGroup") {
    return (
      <CreateGroupScreen relayUrl={relayUrl} onBack={() => setScreen({ name: "join" })} onCreated={handleGroupCreated} />
    );
  }

  if (screen.name === "invite") {
    return (
      <InviteScreen
        invite={screen.invite}
        isConfirming={screen.isConfirming}
        errorMessage={screen.errorMessage}
        onBack={() => setScreen({ name: "join" })}
        onConfirm={handleConfirmJoin}
      />
    );
  }

  // 会议界面优先——正在开会时不该被其他界面盖住
  if (conference) {
    const s = activeSession() ?? sortSessions(sessions)[0];
    return (
      <ConferenceScreen
        state={conference}
        groupName={s?.groupName ?? ""}
        myNickname={nickname}
        elapsedSec={conferenceElapsed}
        onToggleSelfMute={toggleConferenceMute}
        onLeave={leaveConference}
      />
    );
  }

  // 有通话时，通话界面优先于消息列表/聊天页显示
  if (screen.name === "connected" && screen.call) {
    const call = screen.call;
    const callSession = activeSession();
    return (
      <CallScreen
        hasTurn={ICE_CONFIG.hasTurn}
        kind={call.kind}
        info={call.info}
        peerLabel={callSession?.groupName ?? t("call.defaultPeerLabel")}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        onAccept={() => void call.session.accept()}
        onReject={() => void call.session.reject()}
        onHangup={() =>
          void (call.info.state === "outgoing" || call.info.state === "ringing-remote"
            ? call.session.cancel()
            : call.session.hangup())
        }
        onToggleMute={(muted) => call.session.setMuted(muted)}
        onToggleCamera={(enabled) => call.session.setCameraEnabled(enabled)}
        onDismiss={handleDismissCall}
      />
    );
  }

  const active = activeSession();

  if (screen.view === "list" || !active) {
    return (
      <MessageListScreen
        initialTab={screen.activeGroupId === null && cameFromChatRef.current ? "messages" : undefined}
        groups={sortSessions(sessions).map((s) => ({
          groupId: s.groupId,
          groupName: s.groupName,
          unread: unreadFor(s),
          onlineCount: s.onlinePeers.length,
          lastMessage: previewFor(s),
        }))}
        onOpenGroupSettings={(groupId) => setScreen({ name: "groupSettings", groupId, from: "list" })}
        onOpenGroup={(groupId) => {
          // 打开即标记已读
          setSessions((prev) => patchSession(prev, groupId, { lastReadAtMs: Date.now() }));
          setScreen((prev) =>
            prev.name === "connected" ? { ...prev, activeGroupId: groupId, view: "chat" } : prev
          );
        }}
        onJoinAnotherGroup={() => setScreen({ name: "join" })}
        todayContent={mergedToday()}
        // 只看有没有管理员密钥。七次点击本来是为了对普通成员隐藏发布入口，
        // 但没有密钥的人本来就发不出去——那个手势只是把入口对唯一需要它的人
        // （建群者）也藏了起来，他根本不知道要去点版本号。
        isAdmin={holdsAdminKey}
        onOpenAdmin={() => setScreen({ name: "adminPublish" })}
        onOpenAdminRecovery={() => setScreen({ name: "adminRecovery" })}
        onOpenLockSetup={() => setShowLockSetup(true)}
        onOpenDiagnostics={() => setScreen({ name: "diagnostics" })}
        onOpenDevices={() => setScreen({ name: "devices" })}
        onOpenEditProfile={() => setScreen({ name: "editProfile" })}
        onAdminUnlocked={() => {
          void setAdminUnlocked(true);
          setIsAdmin(true);
        }}
        deviceId={screen.deviceId}
        nickname={nickname}
        onOpenServerSettings={() => setScreen({ name: "serverSettings" })}
        relayUrl={relayUrl}
        screenSecurityEnabled={screenSecurityEnabled}
        onToggleScreenSecurity={screenSecuritySupported() ? handleToggleScreenSecurity : undefined}
        biometricEnabled={biometricEnabled}
        onToggleBiometric={biometricSupported ? handleToggleBiometric : undefined}
        lockEnabled={lockEnabled}
        onOpenBackup={() => setScreen({ name: "backup" })}
        dataProtection={dataProtection}
      />
    );
  }

  if (screen.view === "search") {
    return (
      <MessageSearchScreen
        groupName={active.groupName}
        messages={active.messages}
        onBack={() => setScreen({ ...screen, view: "chat" })}
      />
    );
  }

  return (
    <ChatScreen
      groupName={active.groupName}
      messages={active.messages}
      incomingProgress={active.incomingProgress}
      sendError={active.sendError}
      sendProgress={active.sendProgress}
      connectionStatus={active.connectionStatus}
      pendingCount={active.pendingCount}
      knownPeers={active.onlinePeers}
      onStartCall={(kind, peer) => void handleStartCall(kind, peer)}
      onSend={handleSendMessage}
      onSendFile={handleSendFile}
      onCopyMessage={handleCopyMessage}
      onDeleteMessage={(id) => void handleDeleteMessage(id)}
      onSetReplyTarget={setReplyTarget}
      replyTarget={replyTarget}
      onOpenSearch={() => setScreen({ ...screen, view: "search" })}
      onStartConference={handleStartConference}
      onOpenGroupSettings={() => setScreen({ name: "groupSettings", groupId: active.groupId, from: "chat" })}
      myNickname={nickname}
      memberNames={active.knownDevices.map((d) => d.displayName)}
      knownDevices={active.knownDevices}
      myDeviceId={myDeviceIdRef.current}
      onBack={() => {
        setReplyTarget(null);
        // 从聊天返回应该看到消息列表，而不是默认的公告 tab
        cameFromChatRef.current = true;
        setScreen({ ...screen, view: "list", activeGroupId: null });
      }}
    />
  );
}
