import { colors, ChatBubble, Composer } from "@secureinchat/ui";

export interface DisplayMessage {
  id: string;
  text: string;
  isOwn: boolean;
  fromDeviceId?: string;
}

export interface ChatScreenProps {
  groupName: string;
  messages: DisplayMessage[];
  onSend: (text: string) => Promise<void>;
  sendError?: string | undefined;
  onBack: () => void;
}

/**
 * 纯展示的聊天页——消息数组和发送逻辑都由 App 层传进来，这个组件本身不持有
 * 状态、不订阅 RelayClient。这样从聊天页切回消息列表再切回来，消息不会因为
 * 组件卸载而丢失（消息状态活在 App 里，不活在这个组件里）。
 */
export function ChatScreen({ groupName, messages, onSend, sendError, onBack }: ChatScreenProps) {
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
      <Composer onSend={onSend} />
    </div>
  );
}
