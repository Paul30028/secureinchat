import { colors, touchTarget } from "../tokens";

/**
 * 底部导航严格只有三项（第六节要求）：公告、消息、我的。不接受传入任意数量的 tab——
 * 这里刻意用固定的三元组类型而不是数组 prop，防止后面有人"顺手"加第四个。
 */
export type BottomNavKey = "announcements" | "messages" | "me";

export interface BottomNavProps {
  active: BottomNavKey;
  onChange: (key: BottomNavKey) => void;
  /** 未读消息数，仅"消息"tab 需要 */
  unreadCount?: number;
}

const items: { key: BottomNavKey; label: string }[] = [
  { key: "announcements", label: "公告" },
  { key: "messages", label: "消息" },
  { key: "me", label: "我的" },
];

function TabIcon({ tabKey, active }: { tabKey: BottomNavKey; active: boolean }) {
  const stroke = active ? colors.deepInkGreen : "#9A9A94";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.8 };
  if (tabKey === "announcements") {
    return (
      <svg {...common}>
        <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6l-4 4H4a1 1 0 0 0-1 1z" />
        <path d="M14 8a4 4 0 0 1 0 8" />
      </svg>
    );
  }
  if (tabKey === "messages") {
    return (
      <svg {...common}>
        <path d="M4 5h16v11H8l-4 4V5z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.5-4 4.2-6 7-6s5.5 2 7 6" />
    </svg>
  );
}

export function BottomNav({ active, onChange, unreadCount }: BottomNavProps) {
  return (
    <nav
      role="tablist"
      aria-label="主导航"
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        background: colors.ivory,
        borderTop: `0.5px solid ${colors.sageMint}`,
        boxShadow: "none",
      }}
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            style={{
              minHeight: touchTarget.minDp,
              minWidth: touchTarget.minDp,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              background: "transparent",
              border: "none",
              boxShadow: "none",
              position: "relative",
              cursor: "pointer",
            }}
          >
            <TabIcon tabKey={item.key} active={isActive} />
            {item.key === "messages" && unreadCount ? (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: "28%",
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: "#B23A3A",
                  color: colors.ivory,
                  fontSize: 10,
                  lineHeight: "16px",
                  textAlign: "center",
                  padding: "0 3px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
            <span style={{ fontSize: 11, color: isActive ? colors.deepInkGreen : "#9A9A94" }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
