import { useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import { joinGroupFromInvite, MissingGroupIdError, RelayClient } from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { getDeviceStore, getDeviceIdentity } from "./deviceStoreStub";
import { RELAY_URL } from "./relayConfig";

type Screen =
  | { name: "splash" }
  | {
      name: "invite";
      invite: InviteInfo;
      parsed?: ParsedInvite | undefined;
      isConfirming: boolean;
      errorMessage?: string | undefined;
    }
  | { name: "messages"; groupName: string; client: RelayClient }
  | { name: "chat"; groupName: string; client: RelayClient };

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

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "splash" });

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
      // 每次页面加载都是全新的临时设备身份（见 deviceStoreStub.ts 的注释），
      // 对 relay 来说永远是"没见过的新设备"，所以固定走 register（TOFU）。
      await client.connect("register");

      const groupName = screen.invite.status === "valid" ? screen.invite.groupName : "邀群密聊";
      setScreen({ name: "messages", groupName, client });
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

  if (screen.name === "splash") {
    return <SplashScreen onSubmitInviteCode={handleSubmitInviteCode} />;
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

  if (screen.name === "messages") {
    return (
      <MessageListScreen
        joinedGroupName={screen.groupName}
        onOpenChat={() => setScreen({ name: "chat", groupName: screen.groupName, client: screen.client })}
      />
    );
  }

  return (
    <ChatScreen
      groupName={screen.groupName}
      client={screen.client}
      onBack={() => setScreen({ name: "messages", groupName: screen.groupName, client: screen.client })}
    />
  );
}
