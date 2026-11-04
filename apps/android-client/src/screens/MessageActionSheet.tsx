import { colors, radii, touchTarget } from "@secureinchat/ui";
import { t } from "../i18n";

export type MessageAction = "copy" | "reply" | "delete";

export interface MessageActionSheetProps {
  /** 被操作的消息的显示摘要，让用户确认自己点对了 */
  excerpt: string;
  /** 媒体消息没有文字可复制，不显示"复制"这一项 */
  canCopy: boolean;
  onAction: (action: MessageAction) => void;
  onCancel: () => void;
}

/**
 * 长按消息后弹出的操作面板。
 *
 * "删除本机消息"这个措辞是刻意的：删除只影响这台设备，对方那边还在。
 * 中继不保存消息，也没有"撤回"这种协议动作——说成"删除"会让人误以为
 * 对方也看不到了。
 */
export function MessageActionSheet({ excerpt, canCopy, onAction, onCancel }: MessageActionSheetProps) {
  const itemStyle = {
    minHeight: touchTarget.minDp,
    width: "100%",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    fontSize: 15,
    color: colors.textPrimary,
    cursor: "pointer",
    textAlign: "center" as const,
  };

  return (
    <div
      role="dialog"
      aria-label={t("actions.label")}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: colors.ivory,
          borderTopLeftRadius: radii.cardLarge,
          borderTopRightRadius: radii.cardLarge,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#8A8A82",
            textAlign: "center",
            padding: "4px 0 10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {excerpt}
        </div>

        {canCopy ? (
          <button onClick={() => onAction("copy")} style={itemStyle}>
            {t("common.copy")}
          </button>
        ) : null}
        <button onClick={() => onAction("reply")} style={itemStyle}>
          {t("actions.reply")}
        </button>
        <button onClick={() => onAction("delete")} style={{ ...itemStyle, color: "#A33" }}>
          {t("actions.delete")}
        </button>
        <div style={{ fontSize: 11, color: "#9A9A94", textAlign: "center", padding: "2px 0 8px" }}>
          {t("actions.deleteNote")}
        </div>

        <button
          onClick={onCancel}
          style={{ ...itemStyle, borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 4, color: "#8A8A82" }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
