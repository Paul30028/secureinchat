import { colors, radii } from "@secureinchat/ui";

export interface MediaContent {
  mediaKind: "image" | "voice" | "file";
  fileName: string;
  mimeType: string;
  objectUrl: string;
  sizeBytes: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 图片/语音/文件三种媒体消息的渲染。放在 ChatBubble 内部作为 children。 */
export function MediaBubbleContent({
  media,
  isOwn,
  onOpenImage,
}: {
  media: MediaContent;
  isOwn: boolean;
  onOpenImage?: ((media: MediaContent) => void) | undefined;
}) {
  const subduedColor = isOwn ? "rgba(235,236,229,0.75)" : "#8A8A82";

  if (media.mediaKind === "image") {
    return (
      <button
        onClick={() => onOpenImage?.(media)}
        aria-label={`查看 ${media.fileName}`}
        style={{
          display: "block",
          padding: 0,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          cursor: "pointer",
        }}
      >
        <img
          src={media.objectUrl}
          alt={media.fileName}
          style={{ maxWidth: 200, maxHeight: 200, borderRadius: radii.cardSmall, display: "block" }}
        />
      </button>
    );
  }

  if (media.mediaKind === "voice") {
    return (
      <div style={{ minWidth: 180 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={media.objectUrl} style={{ width: "100%", height: 32 }} />
        <div style={{ fontSize: 10, color: subduedColor, marginTop: 4 }}>语音 · {formatSize(media.sizeBytes)}</div>
      </div>
    );
  }

  return (
    <a
      href={media.objectUrl}
      download={media.fileName}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
        color: "inherit",
        minWidth: 160,
      }}
    >
      <span style={{ fontSize: 20 }} aria-hidden="true">
        📎
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {media.fileName}
        </span>
        <span style={{ display: "block", fontSize: 10, color: subduedColor }}>
          {formatSize(media.sizeBytes)} · 已加密 · 点击下载
        </span>
      </span>
    </a>
  );
}

/** 每日公告卡片——展示在聊天流上方，不是普通气泡 */
export function AnnouncementCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: `${colors.sageMint}44`,
        border: `0.5px solid ${colors.sageMint}`,
        borderRadius: radii.cardMedium,
        padding: "10px 14px",
        margin: "0 0 4px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: colors.wheatGold, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</div>
    </div>
  );
}
