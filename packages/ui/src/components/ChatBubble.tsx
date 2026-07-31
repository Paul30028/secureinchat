import type { ReactNode } from "react";
import { colors, radii } from "../tokens";

export type MessageStatus = "sent" | "delivered" | "read";

export interface ChatBubbleProps {
  children: ReactNode;
  /** true = 自己发的（气泡靠右、深墨绿底、白字）；false = 对方发的（靠左、象牙白底、深色字） */
  isOwn: boolean;
  timeLabel: string;
  /** 只有自己发的消息才有已发送/已送达/已读状态；对方发的消息不显示这个 */
  status?: MessageStatus;
  /** 群聊里对方消息上方显示发送人名字；自己的消息、或者一对一场景不需要传 */
  senderName?: string;
}

function StatusTicks({ status }: { status: MessageStatus }) {
  const color = status === "read" ? colors.wheatGold : "rgba(235,236,229,0.7)";
  const doubleTick = status === "delivered" || status === "read";
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true">
      <path d="M1 5l2.5 2.5L8 2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {doubleTick && (
        <path d="M6 5l2.5 2.5L13 2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "已发送",
  delivered: "已送达",
  read: "已读",
};

/** 聊天气泡。不用阴影——磨砂卡片风格延伸到气泡上，靠描边和底色区分自己/对方。 */
export function ChatBubble({ children, isOwn, timeLabel, status, senderName }: ChatBubbleProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
      {!isOwn && senderName ? (
        <span style={{ fontSize: 12, color: "#8A8A82", margin: "0 4px 4px" }}>{senderName}</span>
      ) : null}
      <div
        style={{
          maxWidth: "78%",
          background: isOwn ? colors.deepInkGreen : colors.ivory,
          color: isOwn ? colors.ivory : colors.textPrimary,
          border: isOwn ? "none" : `0.5px solid ${colors.sageMint}`,
          borderRadius: radii.cardMedium,
          padding: "8px 12px",
          boxShadow: "none",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {children}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "4px 4px 0" }}>
        <span style={{ fontSize: 10, color: "#9A9A94" }}>{timeLabel}</span>
        {isOwn && status ? (
          <span title={STATUS_LABEL[status]} style={{ display: "inline-flex" }}>
            <StatusTicks status={status} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
