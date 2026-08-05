import { useMemo, useState } from "react";
import { colors, touchTarget } from "@secureinchat/ui";
import { searchMessages } from "@secureinchat/chat-core";
import type { DisplayMessage } from "./ChatScreen";
import { formatMessageTime } from "../timeFormat";

export interface MessageSearchScreenProps {
  groupName: string;
  messages: DisplayMessage[];
  onBack: () => void;
}

/**
 * 消息搜索。全部在本地做——消息已经解密存在本机，中继上只有密文，
 * 服务端既搜不了也不该能搜。
 */
export function MessageSearchScreen({ groupName, messages, onBack }: MessageSearchScreenProps) {
  const [query, setQuery] = useState("");

  const searchable = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        text: m.text,
        media: m.media ? { fileName: m.media.fileName } : undefined,
        senderLabel: m.fromDeviceId,
        sentAtMs: m.sentAtMs,
        isOwn: m.isOwn,
      })),
    [messages]
  );

  const hits = useMemo(() => searchMessages(searchable, query), [searchable, query]);
  const trimmed = query.trim();

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
        <button
          onClick={onBack}
          aria-label="返回"
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
            color: colors.deepInkGreen,
            cursor: "pointer",
            minHeight: touchTarget.minDp,
          }}
        >
          ←
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`在「${groupName}」中搜索`}
          aria-label="搜索关键词输入框"
          autoFocus
          style={{
            flex: 1,
            minHeight: touchTarget.minDp,
            border: `0.5px solid ${colors.sageMint}`,
            borderRadius: 20,
            padding: "0 16px",
            fontSize: 14,
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {!trimmed ? (
          <p style={{ fontSize: 12, color: "#9A9A94", textAlign: "center", marginTop: 24 }}>
            输入关键词搜索本群的消息
          </p>
        ) : hits.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9A9A94", textAlign: "center", marginTop: 24 }}>
            没有找到包含「{trimmed}」的消息
          </p>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#9A9A94", padding: "4px 0 8px" }}>
              找到 {hits.length} 条
            </div>
            {hits.map(({ message }) => (
              <div
                key={message.id}
                style={{
                  padding: "10px 0",
                  borderBottom: `0.5px solid ${colors.sageMint}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: colors.deepInkGreen }}>
                    {message.isOwn ? "我" : (message.senderLabel ?? "对方")}
                  </span>
                  <span style={{ fontSize: 11, color: "#9A9A94" }}>{formatMessageTime(message.sentAtMs)}</span>
                </div>
                <div style={{ fontSize: 14, color: colors.textPrimary, wordBreak: "break-word" }}>
                  {message.text ?? `[文件] ${message.media?.fileName ?? ""}`}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
