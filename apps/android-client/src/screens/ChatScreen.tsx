import { useEffect, useRef, useState } from "react";
import { colors, ChatBubble, Composer } from "@secureinchat/ui";
import type { RelayClient } from "@secureinchat/chat-core";

export interface ChatScreenProps {
  groupName: string;
  client: RelayClient;
  onBack: () => void;
}

interface DisplayMessage {
  id: string;
  text: string;
  isOwn: boolean;
  fromDeviceId?: string;
}

/**
 * 真正收发消息的聊天页。中继按设计不会把你自己发的消息再转发回给你
 * （见 RELAY_CONTRACT_V0.md 的"密文转发"一节），所以这里发出去的消息是
 * 本地直接追加显示，收到的（onMessage 回调）一定是别人发的。
 */
export function ChatScreen({ groupName, client, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const nextId = useRef(0);

  useEffect(() => {
    client.onMessage((msg) => {
      setMessages((prev) => [
        ...prev,
        { id: `recv-${nextId.current++}`, text: msg.text, isOwn: false, fromDeviceId: msg.fromDeviceId },
      ]);
    });
  }, [client]);

  async function handleSend(text: string) {
    setSendError(undefined);
    try {
      await client.sendText(text);
      setMessages((prev) => [...prev, { id: `sent-${nextId.current++}`, text, isOwn: true }]);
    } catch {
      setSendError("发送失败，请检查连接");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
        <button
          onClick={onBack}
          aria-label="返回"
          style={{ background: "transparent", border: "none", boxShadow: "none", color: colors.deepInkGreen, cursor: "pointer" }}
        >
          ←
        </button>
        <span style={{ fontSize: 16, fontWeight: 500, color: colors.deepInkGreen }}>{groupName}</span>
      </div>

      <div style={{ flex: 1, padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9A9A94", fontSize: 12, marginTop: 24 }}>还没有消息，说点什么吧</p>
        ) : (
          messages.map((m) => (
            <ChatBubble key={m.id} isOwn={m.isOwn} timeLabel="刚刚" senderName={m.isOwn ? undefined : m.fromDeviceId}>
              {m.text}
            </ChatBubble>
          ))
        )}
      </div>

      {sendError ? (
        <p role="alert" style={{ color: "#A33", fontSize: 12, textAlign: "center", margin: "0 0 4px" }}>
          {sendError}
        </p>
      ) : null}
      <Composer onSend={handleSend} />
    </div>
  );
}
