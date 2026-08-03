import { useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import { joinGroupFromInvite, MissingGroupIdError, RelayClient } from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { CreateGroupScreen } from "./screens/CreateGroupScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen, type DisplayMessage } from "./screens/ChatScreen";
import { getDeviceStore, getDeviceIdentity } from "./deviceIdentity";
import { RELAY_URL } from "./relayConfig";

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

    client.onMessage((msg) => {
      setScreen((prev) =>
        prev.name === "connected"
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { id: `recv-${nextMessageId++}`, text: msg.text, isOwn: false, fromDeviceId: msg.fromDeviceId },
              ],
            }
          : prev
      );
    });

    setScreen({ name: "connected", groupName, client, messages: [], view: "list" });
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

  if (screen.view === "list") {
    return (
      <MessageListScreen
        joinedGroupName={screen.groupName}
        onOpenChat={() => setScreen({ ...screen, view: "chat" })}
      />
    );
  }

  return (
    <ChatScreen
      groupName={screen.groupName}
      messages={screen.messages}
      sendError={screen.sendError}
      onSend={handleSendMessage}
      onBack={() => setScreen({ ...screen, view: "list" })}
    />
  );
}
