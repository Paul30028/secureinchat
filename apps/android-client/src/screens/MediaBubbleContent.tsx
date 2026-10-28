import { colors, radii } from "@secureinchat/ui";

export interface MediaContent {
  mediaKind: "image" | "voice" | "file";
  fileName: string;
  mimeType: string;
  objectUrl: string;
  sizeBytes: number;
  /** 语音时长（毫秒）。有就显示 m:ss，没有就回退到 audio 元素自己的行为。 */
  durationMs?: number | undefined;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 把毫秒格式化成 m:ss。
 * 规则：不足 1 秒向下取整为 0:00；1 小时显示成 60:00。
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
    const durationLabel = media.durationMs !== undefined ? formatDuration(media.durationMs) : undefined;
    return (
      <div style={{ minWidth: 180 }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={media.objectUrl} style={{ width: "100%", height: 32 }} />
        <div style={{ fontSize: 10, color: subduedColor, marginTop: 4 }}>
          语音{durationLabel ? ` · ${durationLabel}` : ""} · {formatSize(media.sizeBytes)}
        </div>
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
