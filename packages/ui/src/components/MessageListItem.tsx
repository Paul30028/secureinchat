import type { ButtonHTMLAttributes } from "react";
import { colors, touchTarget } from "../tokens";
import { Avatar, type AvatarSize } from "./Avatar";

export interface MessageListItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name"> {
  name: string;
  avatarSrc?: string;
  /** 消息预览，一行截断——截断本身交给外层容器的 CSS（overflow/text-overflow），
   *  这里不内置固定宽度，避免在不同屏宽下写死尺寸 */
  previewText: string;
  /** 展示用的时间文案，格式化交给调用方（"09:30"/"昨天"/"周一"这类判断依赖当前时间，
   *  不应该放进纯展示组件里） */
  timeLabel: string;
  unreadCount?: number;
}

const avatarSize: AvatarSize = "medium";

/** 消息列表的一行。整行可点击（进入该会话），最小触控高度按 48dp 走。 */
export function MessageListItem({
  name,
  avatarSrc,
  previewText,
  timeLabel,
  unreadCount,
  style,
  ...rest
}: MessageListItemProps) {
  return (
    <button
      {...rest}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: touchTarget.minDp,
        padding: "10px 4px",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        textAlign: "left",
        cursor: "pointer",
        ...style,
      }}
    >
      <Avatar src={avatarSrc} name={name} size={avatarSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: colors.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#8A8A82",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
          }}
        >
          {previewText}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#9A9A94" }}>{timeLabel}</span>
        {unreadCount ? (
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: colors.deepInkGreen,
              color: colors.ivory,
              fontSize: 11,
              lineHeight: "18px",
              textAlign: "center",
              padding: "0 5px",
              boxShadow: "none",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </div>
    </button>
  );
}
