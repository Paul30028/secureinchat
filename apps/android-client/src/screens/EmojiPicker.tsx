import { colors, touchTarget } from "@secureinchat/ui";
import { useT } from "../i18n";

/**
 * 表情面板。
 *
 * 不引入表情库：常用的就那么几十个，一个数组够了，而完整的 emoji 库要几百 KB，
 * 对一个装在手机上的小应用不值。
 *
 * 表情就是普通字符，跟着消息一起加密发送，中继看到的还是密文。
 */

type EmojiRowKey = "common" | "mood" | "daily";

const EMOJI_ROWS: { labelKey: EmojiRowKey; items: string[] }[] = [
  {
    labelKey: "common",
    items: ["😊", "😄", "🥹", "😭", "😅", "🤝", "🙏", "❤️", "👍", "👌", "🎉", "✨", "🌿", "☀️"],
  },
  {
    labelKey: "mood",
    items: ["😌", "🤗", "😇", "🥰", "😴", "🤔", "😮", "😢", "😰", "😤", "🫶", "💪", "🕊️", "🌈"],
  },
  {
    labelKey: "daily",
    items: ["🍚", "☕", "🎵", "📖", "🏠", "🚗", "⏰", "📅", "☔", "❄️", "🌙", "⭐", "🔥", "🎂"],
  },
];

export interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  const t = useT();

  return (
    <div
      role="listbox"
      aria-label={t("emojiPicker.title")}
      style={{
        maxHeight: 200,
        overflowY: "auto",
        padding: "8px 10px",
        borderTop: `0.5px solid ${colors.sageMint}`,
      }}
    >
      {EMOJI_ROWS.map((row) => (
        <div key={row.labelKey} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#9A9A94", marginBottom: 4 }}>
            {t(`emojiPicker.row.${row.labelKey}`)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {row.items.map((emoji) => (
              <button
                key={emoji}
                role="option"
                aria-selected={false}
                aria-label={t("emojiPicker.emojiLabel", { emoji })}
                onClick={() => onPick(emoji)}
                style={{
                  minWidth: touchTarget.minDp,
                  minHeight: touchTarget.minDp,
                  fontSize: 22,
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
