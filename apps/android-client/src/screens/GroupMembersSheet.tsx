import { colors, radii, touchTarget } from "@secureinchat/ui";
import { sortByRecency, type KnownDevice } from "@secureinchat/chat-core";

export interface GroupMembersSheetProps {
  devices: KnownDevice[];
  /** 当前在线的 deviceId */
  onlineNow: string[];
  myDeviceId: string;
  myNickname?: string | undefined;
  onClose: () => void;
}

function shortId(deviceId: string): string {
  return deviceId.replace(/^device-/, "").slice(0, 6);
}

/**
 * 群成员。
 *
 * 只显示"2 人在线"不够用——你想知道的是**谁**在线。名字来自对方发消息时
 * 带的昵称；从没发过话的人只有设备短号，因为中继不知道谁叫什么。
 */
export function GroupMembersSheet({
  devices,
  onlineNow,
  myDeviceId,
  myNickname,
  onClose,
}: GroupMembersSheetProps) {
  // 在线的排前面，其次按最近见到的时间
  const sorted = sortByRecency(devices).sort((a, b) => {
    const aOnline = onlineNow.includes(a.deviceId) ? 0 : 1;
    const bOnline = onlineNow.includes(b.deviceId) ? 0 : 1;
    return aOnline - bOnline;
  });

  const onlineCount = onlineNow.length;

  return (
    <div
      role="dialog"
      aria-label="群成员"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "70%",
          overflowY: "auto",
          background: colors.ivory,
          borderTopLeftRadius: radii.cardLarge,
          borderTopRightRadius: radii.cardLarge,
          padding: "16px 16px 24px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, marginBottom: 2 }}>
          群成员
        </div>
        <div style={{ fontSize: 11, color: "#9A9A94", marginBottom: 12 }}>
          {onlineCount > 0 ? `${onlineCount} 人在线` : "其他人都不在线"}
        </div>

        {/* 自己 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 0",
            borderBottom: `0.5px solid ${colors.sageMint}`,
          }}
        >
          <span style={{ fontSize: 14, color: colors.textPrimary }}>{myNickname ?? "我"}</span>
          <span style={{ fontSize: 11, color: colors.deepInkGreen }}>本机</span>
        </div>

        {sorted
          .filter((d) => d.deviceId !== myDeviceId)
          .map((d) => {
            const online = onlineNow.includes(d.deviceId);
            return (
              <div
                key={d.deviceId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 0",
                  borderBottom: `0.5px solid ${colors.sageMint}`,
                }}
              >
                <span style={{ fontSize: 14, color: colors.textPrimary }}>
                  {d.displayName ?? `设备 ${shortId(d.deviceId)}`}
                </span>
                {d.displayName ? null : (
                  <span style={{ fontSize: 10, color: "#9A9A94" }}>（还没发过消息）</span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: online ? colors.wheatGold : "#9A9A94",
                  }}
                >
                  {online ? "在线" : "不在线"}
                </span>
              </div>
            );
          })}

        {sorted.filter((d) => d.deviceId !== myDeviceId).length === 0 ? (
          <div style={{ fontSize: 12, color: "#9A9A94", padding: "16px 0", textAlign: "center" }}>
            还没见到其他成员。别人上线或发消息后会出现在这里。
          </div>
        ) : null}

        <button
          onClick={onClose}
          style={{
            minHeight: touchTarget.minDp,
            width: "100%",
            marginTop: 12,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            color: "#8A8A82",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
