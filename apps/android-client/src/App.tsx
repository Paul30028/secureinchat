import { useEffect, useRef, useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import {
  joinGroupFromInvite,
  MissingGroupIdError,
  RelayClient,
  FileAssembler,
  buildFileEnvelopes,
  loadMessages,
  saveMessages,
  loadJoinedGroups,
  saveJoinedGroups,
  upsertGroup,
  copyToClipboard,
  buildReplyExcerpt,
  type ConnectionStatus,
  type AnnouncementCategory,
} from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { JoinGroupScreen } from "./screens/JoinGroupScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { CreateGroupScreen } from "./screens/CreateGroupScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen, type DisplayMessage } from "./screens/ChatScreen";
import { TodayScreen, type TodayContent } from "./screens/TodayScreen";
import { AdminPublishScreen } from "./screens/AdminPublishScreen";
import { isAdminUnlocked, setAdminUnlocked } from "./adminAccess";
import { CallScreen } from "./screens/CallScreen";
import { CallSession, type CallKind, type CallStateInfo } from "@secureinchat/webrtc";
import { getDeviceStore, getDeviceIdentity } from "./deviceIdentity";
import { randomUUID } from "@secureinchat/crypto-core";
import { RELAY_URL, ICE_CONFIG } from "./relayConfig";
import { ServerSettingsScreen } from "./screens/ServerSettingsScreen";
import { MessageSearchScreen } from "./screens/MessageSearchScreen";
import { loadSavedRelayUrl } from "./relayUrlSetting";
import { ProfileSetupScreen } from "./screens/ProfileSetupScreen";
import { loadNickname, saveNickname, displayNameFor } from "./profile";
import { toStored, fromStored } from "./messageMapping";
import {
  patchSession,
  sortSessions,
  unreadFor,
  previewFor,
  type GroupSession,
  type GroupSessions,
} from "./groupSession";
import { isSecureContextAvailable, InsecureContextNotice } from "./SecureContextGuard";

interface ActiveCall {
  session: CallSession;
  kind: CallKind;
  info: CallStateInfo;
  peerDeviceId: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

type Screen =
  | { name: "join" }
  | { name: "createGroup" }
  | { name: "serverSettings" }
  | { name: "adminPublish" }
  | {
      name: "invite";
      invite: InviteInfo;
      parsed?: ParsedInvite | undefined;
      isConfirming: boolean;
      errorMessage?: string | undefined;
    }
  // "messages" 和 "chat" 合成一个状态，view 只决定渲染哪个屏幕——消息数组
  // 活在这一个对象里，在两个视图之间切换不会因为组件卸载而丢失历史。
  | {
      name: "connected";
      /** 当前打开的群；null 表示在群列表页 */
      activeGroupId: string | null;
      view: "list" | "chat" | "search";
      deviceId: string;
      call?: ActiveCall | undefined;
    };

/**
 * protocol 包解析出的 InviteParseError.reason 和 ui 包 InviteInfoCard 期待的
 * reason 不是同一套枚举——前者是"哪里解析失败"（bad-prefix/invalid-json 等，
 * 面向协议实现者），后者是"给用户看的失效原因"（面向最终用户）。这里做一次
 * 明确的映射，不要把协议层的内部错误码直接展示给用户。
 */
/** 把过期时间戳转成"有效期剩 X 天 Y 小时"这种人话 */
function mediaLabel(kind: "image" | "voice" | "file"): string {
  if (kind === "image") return "图片";
  if (kind === "voice") return "语音";
  return "文件";
}

function formatExpiry(expiresAtMs: number): string {
  const remainMs = expiresAtMs - Date.now();
  if (remainMs <= 0) return "已过期";
  const hours = Math.floor(remainMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `有效期剩 ${days} 天 ${hours % 24} 小时`;
  if (hours > 0) return `有效期剩 ${hours} 小时`;
  return `有效期剩 ${Math.max(1, Math.floor(remainMs / 60_000))} 分钟`;
}

function mapParseErrorReason(reason: InviteParseError["reason"]): "expired" | "exhausted" | "malformed" {
  if (reason === "expired") return "expired";
  if (reason === "exhausted") return "exhausted";
  return "malformed";
}

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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void isAdminUnlocked().then(setIsAdmin);
  }, []);
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
  // 昵称是异步从 IndexedDB 读的。读完之前不能判断"有没有设过"——否则老用户
  // 会被再弹一次设置页，违反"首次设置只出现一次"。
  const [profileLoaded, setProfileLoaded] = useState(false);
  // 首次设置昵称时，用户原本想做的事（加群/建群）先存这里，设置完再继续
  const pendingAfterProfileRef = useRef<(() => void) | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

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
      isAutoReconnectRef.current = true;
      for (const g of groups) {
        try {
          await connectToGroup(
            {
              version: "SIC2",
              isCompatMode: false,
              serverJoinCode: "",
              groupId: g.groupId,
              keyMaterialB64Url: g.keyMaterialB64Url,
              epoch: g.epoch,
            },
            g.groupName
          );
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
  const callFactoryRef = useRef<((callId: string, peer: string, kind: CallKind) => CallSession) | null>(null);
  currentCallRef.current = screen.name === "connected" ? screen.call : undefined;

  /**
   * 派生群密钥、连上 relay——加入邀请码流程和创建群聊流程最终都要做同一件事，
   * 抽成一个函数，不要在两个地方各写一份容易走歪的版本。订阅 onMessage 也在
   * 这里做一次，不放在 ChatScreen 里——ChatScreen 会被卸载/重新挂载（切到消息
   * 列表再切回来），但这个订阅只应该建立一次，跟连接本身的生命周期绑定。
   */
  async function connectToGroup(parsed: ParsedInvite, groupName: string): Promise<void> {
    const store = await getDeviceStore();
    const { epochKey, groupId, epoch } = await joinGroupFromInvite(parsed, store);
    const identity = await getDeviceIdentity();

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
      void saveMessages(
        store,
        groupId,
        messages.map((m) => toStored(m, mediaBytesById?.get(m.id)))
      );
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
        return patchSession(prev, groupId, { messages });
      });
    };

    const history = (await loadMessages(store, groupId)).map(fromStored);

    client.onMessage((msg) => {
      const env = msg.envelope;

      if (env.kind === "text") {
        appendMessage({
          id: `recv-${nextMessageId++}`,
          text: env.text,
          isOwn: false,
          fromDeviceId: displayNameFor(env.senderName, msg.fromDeviceId),
          // 用发送方带过来的时间，不是本机收到的时间——离线补发的消息
          // 应该显示当初发出的时刻
          sentAtMs: env.sentAtMs,
          ...(env.replyTo ? { replyTo: env.replyTo } : {}),
        });
        return;
      }

      if (env.kind === "announcement") {
        // 每个栏目只保留今天这一条，新的覆盖旧的。老客户端发的公告没有
        // category，归到"通知"栏而不是丢掉。
        const category: AnnouncementCategory = env.category ?? "notice";
        setSessions((prev) => {
          const s = prev[groupId];
          if (!s) return prev;
          return patchSession(prev, groupId, {
            today: { ...s.today, [category]: { title: env.title, body: env.body } },
          });
        });
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
          },
        },
        done.bytes
      );
    });

    client.onPeersChange((onlinePeers) => patch({ onlinePeers }));
    client.onStatusChange((connectionStatus) => patch({ connectionStatus }));
    client.onQueueChange((pendingCount) => patch({ pendingCount }));

    const session: GroupSession = {
      groupId,
      groupName,
      client,
      messages: history,
      connectionStatus: client.connectionStatus,
      pendingCount: client.pendingMessageCount,
      onlinePeers: client.onlinePeers,
      today: {},
      lastReadAtMs: Date.now(),
    };

    // 记住这个群，下次启动自动重连
    const groups = upsertGroup(await loadJoinedGroups(store), {
      groupId,
      groupName,
      keyMaterialB64Url: parsed.keyMaterialB64Url,
      epoch,
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

    if (shouldOpenChat) {
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
        groupName: parsed.groupName ?? "加密群聊",
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
      const groupName = screen.invite.status === "valid" ? screen.invite.groupName : "邀群密聊";
      await connectToGroup(parsed, groupName);
    } catch (err) {
      const message =
        err instanceof MissingGroupIdError
          ? "这个邀请是旧版兼容格式，暂不支持加密入群"
          : `加群失败：${err instanceof Error ? err.message : "请重试"}`;
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
  }) {
    const parsed = parseInviteAuto(input.inviteCode); // 复用解析路径，不手搓一份 ParsedInvite
    await connectToGroup(parsed, input.groupName);
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
      void saveMessages(store, groupId, messages.map((m) => toStored(m, mediaBytes && m.id === message.id ? mediaBytes : undefined)));
      return patchSession(prev, groupId, { messages });
    });
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
      void saveMessages(store, session.groupId, messages.map((m) => toStored(m)));
      return patchSession(prev, session.groupId, { messages });
    });
  }

  async function handleSendMessage(text: string) {
    const session = activeSession();
    if (!session) return;
    const { groupId, client } = session;
    setSessions((prev) => patchSession(prev, groupId, { sendError: undefined }));
    try {
      // sendText 现在断线时会排队而不是抛错——排队也算"发出去了"，
      // 连接状态横幅会告诉用户还有几条在等待，不需要再报一次"发送失败"
      const reply = replyTarget
        ? {
            senderName: replyTarget.isOwn ? (nickname ?? "我") : (replyTarget.fromDeviceId ?? "对方"),
            excerpt: buildReplyExcerpt({
              id: replyTarget.id,
              text: replyTarget.text,
              media: replyTarget.media ? { fileName: replyTarget.media.fileName } : undefined,
              sentAtMs: replyTarget.sentAtMs,
            }),
          }
        : undefined;

      await client.sendEnvelope({
        kind: "text",
        id: randomUUID(),
        text,
        sentAtMs: Date.now(),
        ...(nickname ? { senderName: nickname } : {}),
        ...(reply ? { replyTo: reply } : {}),
      });
      setReplyTarget(null);
      await appendOwnMessage(groupId, {
        id: `sent-${nextMessageId++}`,
        text,
        isOwn: true,
        sentAtMs: Date.now(),
        ...(reply ? { replyTo: reply } : {}),
      });
    } catch {
      setSessions((prev) => patchSession(prev, groupId, { sendError: "发送失败，请检查连接" }));
    }
  }

  async function handleSendFile(file: File, mediaKind: "image" | "voice" | "file") {
    const session = activeSession();
    if (!session) return;
    const { groupId, client } = session;
    setSessions((prev) => patchSession(prev, groupId, { sendError: undefined }));

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileId = randomUUID();
      const { meta, chunks } = buildFileEnvelopes({
        fileId,
        ...(nickname ? { senderName: nickname } : {}),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        mediaKind,
        bytes,
      });

      // meta 必须先到，接收方才知道总共有多少片
      await client.sendEnvelope(meta);
      for (const chunk of chunks) {
        await client.sendEnvelope(chunk);
      }

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
          },
        },
        bytes
      );
    } catch {
      setSessions((prev) => patchSession(prev, groupId, { sendError: "发送失败，请检查连接" }));
    }
  }

  async function handlePublishAnnouncement(category: AnnouncementCategory, title: string, body: string) {
    const session = activeSession() ?? sortSessions(sessions)[0];
    if (!session) return;
    await session.client.sendEnvelope({
      kind: "announcement",
      id: randomUUID(),
      category,
      title,
      body,
      sentAtMs: Date.now(),
      ...(nickname ? { senderName: nickname } : {}),
    });
    setSessions((prev) => {
      const s = prev[session.groupId];
      if (!s) return prev;
      return patchSession(prev, session.groupId, { today: { ...s.today, [category]: { title, body } } });
    });
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

  // 昵称是异步从 IndexedDB 读的。读完之前不渲染主界面——否则会出现竞态：
  // 读得慢时老用户被重复要求设昵称，或者新用户点得快就绕过了设置。
  // 这一步通常是几十毫秒，用户几乎察觉不到。
  if (!profileLoaded) {
    return <div style={{ minHeight: "100%", background: "#EBECE5" }} aria-busy="true" />;
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
        onBack={() => setScreen({ name: "connected", activeGroupId: null, view: "list", deviceId: "" })}
      />
    );
  }

  if (screen.name === "serverSettings") {
    return (
      <ServerSettingsScreen
        defaultUrl={RELAY_URL}
        onSaved={(url) => setRelayUrl(url)}
        onBack={() => setScreen({ name: "connected", activeGroupId: null, view: "list", deviceId: "" })}
      />
    );
  }

  if (screen.name === "adminPublish") {
    return (
      <AdminPublishScreen
        content={mergedToday()}
        onPublish={handlePublishAnnouncement}
        onLockAdmin={() => {
          void setAdminUnlocked(false);
          setIsAdmin(false);
          setScreen({ name: "connected", activeGroupId: null, view: "list", deviceId: "" });
        }}
        onBack={() => setScreen({ name: "connected", activeGroupId: null, view: "list", deviceId: "" })}
      />
    );
  }

  if (screen.name === "createGroup") {
    return <CreateGroupScreen onBack={() => setScreen({ name: "join" })} onCreated={handleGroupCreated} />;
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

  // 有通话时，通话界面优先于消息列表/聊天页显示
  if (screen.name === "connected" && screen.call) {
    const call = screen.call;
    const callSession = activeSession();
    return (
      <CallScreen
        hasTurn={ICE_CONFIG.hasTurn}
        kind={call.kind}
        info={call.info}
        peerLabel={callSession?.groupName ?? "通话"}
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

  const allSessions = sortSessions(sessions);
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
        onOpenGroup={(groupId) => {
          // 打开即标记已读
          setSessions((prev) => patchSession(prev, groupId, { lastReadAtMs: Date.now() }));
          setScreen((prev) =>
            prev.name === "connected" ? { ...prev, activeGroupId: groupId, view: "chat" } : prev
          );
        }}
        onJoinAnotherGroup={() => setScreen({ name: "join" })}
        todayContent={mergedToday()}
        isAdmin={isAdmin}
        onOpenAdmin={() => setScreen({ name: "adminPublish" })}
        onAdminUnlocked={() => {
          void setAdminUnlocked(true);
          setIsAdmin(true);
        }}
        deviceId={screen.deviceId}
        nickname={nickname}
        onOpenServerSettings={() => setScreen({ name: "serverSettings" })}
        relayUrl={relayUrl}
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
      onBack={() => {
        setReplyTarget(null);
        // 从聊天返回应该看到消息列表，而不是默认的公告 tab
        cameFromChatRef.current = true;
        setScreen({ ...screen, view: "list", activeGroupId: null });
      }}
    />
  );
}
