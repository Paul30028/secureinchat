import { useState } from "react";
import { InviteParseError, parseInviteAuto, type ParsedInvite } from "@secureinchat/protocol";
import { joinGroupFromInvite, MissingGroupIdError, RelayClient } from "@secureinchat/chat-core";
import type { InviteInfo } from "@secureinchat/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { MessageListScreen } from "./screens/MessageListScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { getDeviceStore, getDeviceIdentity } from "./deviceIdentity";
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
      // 设备身份现在跨刷新持久（见 deviceIdentity.ts），但 relay 端的
      // DeviceRegistry 是内存态的（进程重启就清空），所以没法从客户端直接
      // 知道"这次连接对服务端来说是不是新设备"。先尝试 register（TOFU），
      // 如果服务端说"已经注册过"（relay 进程还没重启，之前连过），
      // 就换成 authenticate 重试一次——而不是把这个已知会发生的情况当异常处理。
      try {
        await client.connect("register");
      } catch (err) {
        if (err instanceof Error && err.message.includes("already registered")) {
          await client.connect("authenticate");
        } else {
          throw err;
        }
      }

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
