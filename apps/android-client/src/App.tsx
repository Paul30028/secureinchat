import { useRef, useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import {
  joinGroupFromInvite,
  MissingGroupIdError,
  RelayClient,
  FileAssembler,
  buildFileEnvelopes,
  type ConnectionStatus,
} from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { CreateGroupScreen } from "./screens/CreateGroupScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen, type DisplayMessage, type Announcement } from "./screens/ChatScreen";
import { CallScreen } from "./screens/CallScreen";
import { CallSession, type CallKind, type CallStateInfo } from "@secureinchat/webrtc";
import { getDeviceStore, getDeviceIdentity } from "./deviceIdentity";
import { RELAY_URL, ICE_CONFIG } from "./relayConfig";
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
  | { name: "splash" }
  | { name: "createGroup" }
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
      groupName: string;
      client: RelayClient;
      messages: DisplayMessage[];
      view: "list" | "chat";
      sendError?: string | undefined;
      connectionStatus: ConnectionStatus;
      pendingCount: number;
      deviceId: string;
      announcement?: Announcement | undefined;
      /** 从收到的消息/信令里观察到的同群设备——单群试用版没有服务端成员列表，
       *  这是目前唯一能知道"群里还有谁在"的途径 */
      knownPeers: string[];
      call?: ActiveCall | undefined;
      incomingProgress?: { fileId: string; fileName: string; receivedChunks: number; totalChunks: number }[];
    };

/**
 * protocol 包解析出的 InviteParseError.reason 和 ui 包 InviteInfoCard 期待的
 * reason 不是同一套枚举——前者是"哪里解析失败"（bad-prefix/invalid-json 等，
 * 面向协议实现者），后者是"给用户看的失效原因"（面向最终用户）。这里做一次
 * 明确的映射，不要把协议层的内部错误码直接展示给用户。
 */
function mapParseErrorReason(reason: InviteParseError["reason"]): "expired" | "exhausted" | "malformed" {
  if (reason === "expired") return "expired";
  if (reason === "exhausted") return "exhausted";
  return "malformed";
}

let nextMessageId = 0;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "splash" });
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

    const client = new RelayClient(RELAY_URL, {
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

    client.onMessage((msg) => {
      const env = msg.envelope;

      // 记录这个设备存在于群里——通话需要知道呼叫对象是谁
      setScreen((prev) =>
        prev.name === "connected" && !prev.knownPeers.includes(msg.fromDeviceId)
          ? { ...prev, knownPeers: [...prev.knownPeers, msg.fromDeviceId] }
          : prev
      );

      if (env.kind === "text") {
        setScreen((prev) =>
          prev.name === "connected"
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  { id: `recv-${nextMessageId++}`, text: env.text, isOwn: false, fromDeviceId: msg.fromDeviceId },
                ],
              }
            : prev
        );
        return;
      }

      if (env.kind === "announcement") {
        // 公告是"当前生效的那一条"，新的覆盖旧的，不堆成列表
        setScreen((prev) =>
          prev.name === "connected"
            ? { ...prev, announcement: { id: env.id, title: env.title, body: env.body } }
            : prev
        );
        return;
      }

      if (env.kind === "file-meta") {
        assembler.acceptMeta(env);
        setScreen((prev) => (prev.name === "connected" ? { ...prev, incomingProgress: assembler.progress() } : prev));
        return;
      }

      // file-chunk：集齐了就组装成一条媒体消息
      const done = assembler.acceptChunk(env);
      if (!done) {
        setScreen((prev) => (prev.name === "connected" ? { ...prev, incomingProgress: assembler.progress() } : prev));
        return;
      }
      const blob = new Blob([done.bytes as BlobPart], { type: done.mimeType });
      const objectUrl = URL.createObjectURL(blob);
      setScreen((prev) =>
        prev.name === "connected"
          ? {
              ...prev,
              incomingProgress: assembler.progress(),
              messages: [
                ...prev.messages,
                {
                  id: `recv-${nextMessageId++}`,
                  isOwn: false,
                  fromDeviceId: msg.fromDeviceId,
                  media: {
                    mediaKind: done.mediaKind,
                    fileName: done.fileName,
                    mimeType: done.mimeType,
                    objectUrl,
                    sizeBytes: done.bytes.byteLength,
                  },
                },
              ],
            }
          : prev
      );
    });

    // 通话信令。这里创建的 CallSession 会驱动整个通话状态机；
    // 每一路通话一个 session，结束后丢弃。
    const updateCall = (patch: Partial<ActiveCall>) => {
      setScreen((prev) =>
        prev.name === "connected" && prev.call ? { ...prev, call: { ...prev.call, ...patch } } : prev
      );
    };

    const makeSession = (callId: string, peerDeviceId: string, kind: CallKind): CallSession =>
      new CallSession({
        callId,
        peerDeviceId,
        kind,
        transport: client,
        iceServers: ICE_CONFIG.iceServers,
        iceTransportPolicy: ICE_CONFIG.iceTransportPolicy,
        onStateChange: (info) => updateCall({ info }),
        onLocalStream: (localStream) => updateCall({ localStream }),
        onRemoteStream: (remoteStream) => updateCall({ remoteStream }),
      });

    callFactoryRef.current = makeSession;

    client.onSignaling(async (sig) => {
      const current = currentCallRef.current;

      if (sig.type === "call_invite") {
        // 已经在通话中又来一通——直接拒掉，不支持呼叫等待
        if (current && current.info.state !== "ended") {
          await client.sendSignaling("call_reject", sig.fromDeviceId, sig.callId, { reason: "busy" });
          return;
        }
        const kind: CallKind = sig.payload.kind === "video" ? "video" : "voice";
        const session = makeSession(sig.callId, sig.fromDeviceId, kind);
        setScreen((prev) =>
          prev.name === "connected"
            ? {
                ...prev,
                call: { session, kind, info: { state: "incoming" }, peerDeviceId: sig.fromDeviceId },
              }
            : prev
        );
        await session.receiveInvite(String(sig.payload.sdp ?? ""));
        return;
      }

      if (!current) return;
      const session = current.session;

      if (sig.type === "call_ring") session.remoteRinging();
      else if (sig.type === "call_answer") await session.receiveAnswer(String(sig.payload.sdp ?? ""));
      else if (sig.type === "ice_candidate") {
        await session.receiveIceCandidate(sig.payload.candidate as RTCIceCandidateInit);
      } else if (sig.type === "call_reject") session.remoteEnded("rejected");
      else if (sig.type === "call_cancel") session.remoteEnded("cancelled");
      else if (sig.type === "call_hangup") session.remoteEnded("hungup");
    });

    // 目标不在线——中继回的 call_failed，如实反映到通话状态上
    client.onCallFailed(() => {
      currentCallRef.current?.session.hangup();
    });

    client.onStatusChange((connectionStatus) => {
      setScreen((prev) => (prev.name === "connected" ? { ...prev, connectionStatus } : prev));
    });
    client.onQueueChange((pendingCount) => {
      setScreen((prev) => (prev.name === "connected" ? { ...prev, pendingCount } : prev));
    });

    setScreen({
      name: "connected",
      groupName,
      client,
      messages: [],
      view: "list",
      deviceId: identity.deviceId,
      knownPeers: [],
      connectionStatus: client.connectionStatus,
      pendingCount: client.pendingMessageCount,
    });
  }

  function handleSubmitInviteCode(raw: string) {
    try {
      const parsed = parseInviteAuto(raw);
      // 解析成功只证明"邀请串格式和有效期本身没问题"，群名、邀请人这些元数据
      // 不在邀请串里，真实产品里要另外问服务器要——这里先用占位内容展示，
      // 明确不是真实数据。真正要用于密钥派生的 parsed（groupId/keyMaterial/epoch）
      // 是真实的解析结果，不是占位。
      const mockInvite: InviteInfo = {
        status: "valid",
        groupName: "同心同行", // 占位：真实群名来自服务器，不来自邀请串本身
        memberCount: 4,
        inviterName: "李阳",
        expiryLabel: "有效期剩 2 天 18 小时",
      };
      setScreen({ name: "invite", invite: mockInvite, parsed, isConfirming: false });
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

  async function handleSendMessage(text: string) {
    if (screen.name !== "connected") return;
    const client = screen.client;
    setScreen({ ...screen, sendError: undefined });
    try {
      // sendText 现在断线时会排队而不是抛错——排队也算"发出去了"，
      // 连接状态横幅会告诉用户还有几条在等待，不需要再报一次"发送失败"
      await client.sendText(text);
      setScreen((prev) =>
        prev.name === "connected"
          ? { ...prev, messages: [...prev.messages, { id: `sent-${nextMessageId++}`, text, isOwn: true }] }
          : prev
      );
    } catch {
      setScreen((prev) => (prev.name === "connected" ? { ...prev, sendError: "发送失败，请检查连接" } : prev));
    }
  }

  async function handleSendFile(file: File, mediaKind: "image" | "voice" | "file") {
    if (screen.name !== "connected") return;
    const client = screen.client;
    setScreen({ ...screen, sendError: undefined });

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileId = crypto.randomUUID();
      const { meta, chunks } = buildFileEnvelopes({
        fileId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        mediaKind,
        bytes,
      });

      // meta 必须先到，接收方才知道总共有多少片；分片按顺序发（网络可能乱序，
      // 接收端的 FileAssembler 已经能处理乱序，这里顺序发只是最自然的做法）
      await client.sendEnvelope(meta);
      for (const chunk of chunks) {
        await client.sendEnvelope(chunk);
      }

      // 自己发的媒体本地直接显示（中继不会把自己发的消息转发回来）
      const objectUrl = URL.createObjectURL(file);
      setScreen((prev) =>
        prev.name === "connected"
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: `sent-${nextMessageId++}`,
                  isOwn: true,
                  media: {
                    mediaKind,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    objectUrl,
                    sizeBytes: bytes.byteLength,
                  },
                },
              ],
            }
          : prev
      );
    } catch {
      setScreen((prev) => (prev.name === "connected" ? { ...prev, sendError: "发送失败，请检查连接" } : prev));
    }
  }

  async function handlePublishAnnouncement(title: string, body: string) {
    if (screen.name !== "connected") return;
    const announcement = { id: crypto.randomUUID(), title, body };
    // 公告走和普通消息完全一样的加密通道——中继不知道这是一条公告。
    // 注意：目前任何成员都能发公告，没有管理员权限校验（管理员体系还没做）。
    await screen.client.sendEnvelope({
      kind: "announcement",
      id: announcement.id,
      title,
      body,
      sentAtMs: Date.now(),
    });
    setScreen((prev) => (prev.name === "connected" ? { ...prev, announcement } : prev));
  }

  async function handleStartCall(kind: CallKind, peerDeviceId: string) {
    if (screen.name !== "connected" || !callFactoryRef.current) return;
    const callId = crypto.randomUUID();
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

  if (screen.name === "splash") {
    return (
      <SplashScreen
        onSubmitInviteCode={handleSubmitInviteCode}
        onCreateGroup={() => setScreen({ name: "createGroup" })}
      />
    );
  }

  if (screen.name === "createGroup") {
    return <CreateGroupScreen onBack={() => setScreen({ name: "splash" })} onCreated={handleGroupCreated} />;
  }

  if (screen.name === "invite") {
    return (
      <InviteScreen
        invite={screen.invite}
        isConfirming={screen.isConfirming}
        errorMessage={screen.errorMessage}
        onBack={() => setScreen({ name: "splash" })}
        onConfirm={handleConfirmJoin}
      />
    );
  }

  // 有通话时，通话界面优先于消息列表/聊天页显示
  if (screen.call) {
    const call = screen.call;
    return (
      <CallScreen
      hasTurn={ICE_CONFIG.hasTurn}
        kind={call.kind}
        info={call.info}
        peerLabel={screen.groupName}
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

  if (screen.view === "list") {
    return (
      <MessageListScreen
        joinedGroupName={screen.groupName}
        onOpenChat={() => setScreen({ ...screen, view: "chat" })}
        announcement={screen.announcement}
        onPublishAnnouncement={handlePublishAnnouncement}
        deviceId={screen.deviceId}
      />
    );
  }

  return (
    <ChatScreen
      groupName={screen.groupName}
      messages={screen.messages}
      announcement={screen.announcement}
      incomingProgress={screen.incomingProgress}
      sendError={screen.sendError}
      connectionStatus={screen.connectionStatus}
      pendingCount={screen.pendingCount}
      knownPeers={screen.knownPeers}
      onStartCall={(kind, peer) => void handleStartCall(kind, peer)}
      onSend={handleSendMessage}
      onSendFile={handleSendFile}
      onBack={() => setScreen({ ...screen, view: "list" })}
    />
  );
}
