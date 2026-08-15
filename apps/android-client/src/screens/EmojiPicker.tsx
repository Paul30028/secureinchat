import { colors, touchTarget } from "@secureinchat/ui";

/**
 * 表情面板。
 *
 * 不引入表情库：常用的就那么几十个，一个数组够了，而完整的 emoji 库要几百 KB，
 * 对一个装在手机上的小应用不值。
 *
 * 表情就是普通字符，跟着消息一起加密发送，中继看到的还是密文。
 */

const EMOJI_ROWS: { label: string; items: string[] }[] = [
  {
    label: "常用",
    items: ["😊", "😄", "🥹", "😭", "😅", "🤝", "🙏", "❤️", "👍", "👌", "🎉", "✨", "🌿", "☀️"],
  },
  {
    label: "心情",
    items: ["😌", "🤗", "😇", "🥰", "😴", "🤔", "😮", "😢", "😰", "😤", "🫶", "💪", "🕊️", "🌈"],
  },
  {
    label: "日常",
    items: ["🍚", "☕", "🎵", "📖", "🏠", "🚗", "⏰", "📅", "☔", "❄️", "🌙", "⭐", "🔥", "🎂"],
  },
];

export interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div
      role="listbox"
      aria-label="选择表情"
      style={{
        maxHeight: 200,
        overflowY: "auto",
        padding: "8px 10px",
        borderTop: `0.5px solid ${colors.sageMint}`,
      }}
    >
      {EMOJI_ROWS.map((row) => (
        <div key={row.label} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "#9A9A94", marginBottom: 4 }}>{row.label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {row.items.map((emoji) => (
              <button
                key={emoji}
                role="option"
                aria-selected={false}
                aria-label={`表情 ${emoji}`}
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
