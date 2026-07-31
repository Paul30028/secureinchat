import { useState } from "react";
import { InviteParseError, parseInviteAuto } from "@secureinchat/protocol";
import type { InviteInfo } from "@secureinchat/ui";
import { SplashScreen } from "./screens/SplashScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { MessageListScreen } from "./screens/MessageListScreen";

type Screen =
  | { name: "splash" }
  | { name: "invite"; invite: InviteInfo }
  | { name: "messages"; groupName: string };

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
      // 解析成功只证明"邀请串格式和有效期本身没问题"，群名、邀请人这些元数据
      // 不在邀请串里，真实产品里要另外问服务器要——这里先用占位内容展示，
      // 明确不是真实数据（见下方注释和 handoff 里的非目标说明）。
      parseInviteAuto(raw);
      const mockInvite: InviteInfo = {
        status: "valid",
        groupName: "同心同行", // 占位：真实群名来自服务器，不来自邀请串本身
        memberCount: 4,
        inviterName: "李阳",
        expiryLabel: "有效期剩 2 天 18 小时",
      };
      setScreen({ name: "invite", invite: mockInvite });
    } catch (err) {
      const reason = err instanceof InviteParseError ? mapParseErrorReason(err.reason) : "malformed";
      setScreen({ name: "invite", invite: { status: "invalid", reason } });
    }
  }

  if (screen.name === "splash") {
    return <SplashScreen onSubmitInviteCode={handleSubmitInviteCode} />;
  }

  if (screen.name === "invite") {
    return (
      <InviteScreen
        invite={screen.invite}
        onBack={() => setScreen({ name: "splash" })}
        onConfirm={() => {
          const groupName = screen.invite.status === "valid" ? screen.invite.groupName : "邀群密聊";
          setScreen({ name: "messages", groupName });
        }}
      />
    );
  }

  return <MessageListScreen joinedGroupName={screen.groupName} />;
}
