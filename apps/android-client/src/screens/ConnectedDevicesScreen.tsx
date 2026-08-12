import { colors, radii, touchTarget } from "@secureinchat/ui";
import { sortByRecency, type KnownDevice } from "@secureinchat/chat-core";
import { formatMessageTime } from "../timeFormat";

export interface ConnectedDevicesScreenProps {
  groupName: string;
  devices: KnownDevice[];
  /** 当前在线的 deviceId */
  onlineNow: string[];
  /** 本机的 deviceId，标出来免得用户以为多了一台 */
  myDeviceId: string;
  onBack: () => void;
}

function shortId(deviceId: string): string {
  return deviceId.replace(/^device-/, "").slice(0, 8);
}

/**
 * 群里见过的设备。
 *
 * 这一页的用途很具体：确认群里没有你不认识的设备。如果发现了，处理办法是
 * 更换群密钥（管理员页面里的"移出成员"）——把新邀请码只发给该留下的人。
 */
export function ConnectedDevicesScreen({
  groupName,
  devices,
  onlineNow,
  myDeviceId,
  onBack,
}: ConnectedDevicesScreenProps) {
  const sorted = sortByRecency(devices);

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={onBack}
        aria-label="返回"
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>群内设备</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 16px" }}>
        「{groupName}」里这台手机见过的设备。发现不认识的，可以让管理员更换群密钥。
      </p>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 14, color: colors.textPrimary }}>还没见到其他设备</div>
          <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 6, lineHeight: 1.7 }}>
            其他人上线或发消息之后会出现在这里
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((d) => {
            const isOnline = onlineNow.includes(d.deviceId);
            const isMe = d.deviceId === myDeviceId;
            return (
              <div
                key={d.deviceId}
                style={{
                  border: `0.5px solid ${colors.sageMint}`,
                  borderRadius: radii.cardSmall,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>
                    {d.displayName ?? `设备 ${shortId(d.deviceId)}`}
                  </span>
                  {isMe ? (
                    <span style={{ fontSize: 11, color: colors.deepInkGreen }}>本机</span>
                  ) : null}
                  {isOnline ? (
                    <span style={{ fontSize: 11, color: colors.wheatGold, marginLeft: "auto" }}>在线</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 4, fontFamily: "monospace" }}>
                  {shortId(d.deviceId)}
                </div>
                <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 2 }}>
                  最近 {formatMessageTime(d.lastSeenMs)} · 首次 {formatMessageTime(d.firstSeenMs)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 20 }}>
        这份名单是本机自己观察到的：中继不保存谁上过线的历史，所以从没和你同时在线、
        也没发过消息的设备不会出现在这里。换新手机后需要重新积累。
      </p>
    </div>
  );
}
