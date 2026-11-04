import { useMemo, useState } from "react";
import { colors, touchTarget } from "@secureinchat/ui";
import { searchMessages } from "@secureinchat/chat-core";
import type { DisplayMessage } from "./ChatScreen";
import { formatMessageTime } from "../timeFormat";
import { t } from "../i18n";

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
          aria-label={t("common.back")}
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
          placeholder={t("search.placeholder", { groupName })}
          aria-label={t("search.input")}
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
            {t("search.prompt")}
          </p>
        ) : hits.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9A9A94", textAlign: "center", marginTop: 24 }}>
            {t("search.noResults", { query: trimmed })}
          </p>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#9A9A94", padding: "4px 0 8px" }}>
              {t("search.found", { count: hits.length })}
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
                    {message.isOwn ? t("common.me") : (message.senderLabel ?? t("common.otherPerson"))}
                  </span>
                  <span style={{ fontSize: 11, color: "#9A9A94" }}>{formatMessageTime(message.sentAtMs)}</span>
                </div>
                <div style={{ fontSize: 14, color: colors.textPrimary, wordBreak: "break-word" }}>
                  {message.text ?? t("media.preview", { label: t("media.file"), fileName: message.media?.fileName ?? "" })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
