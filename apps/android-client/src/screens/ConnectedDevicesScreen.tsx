import { colors, radii, touchTarget } from "@secureinchat/ui";
import { sortByRecency, type KnownDevice } from "@secureinchat/chat-core";
import { formatMessageTime } from "../timeFormat";
import { t } from "../i18n";

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
        aria-label={t("common.back")}
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
        {t("common.backArrow")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>{t("me.devices")}</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 16px" }}>
        {t("devices.intro", { groupName })}
      </p>

      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("devices.none")}</div>
          <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 6, lineHeight: 1.7 }}>
            {t("devices.noneHint")}
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
                    {d.displayName ?? t("common.deviceShort", { id: shortId(d.deviceId) })}
                  </span>
                  {isMe ? (
                    <span style={{ fontSize: 11, color: colors.deepInkGreen }}>{t("common.thisDevice")}</span>
                  ) : null}
                  {isOnline ? (
                    <span style={{ fontSize: 11, color: colors.wheatGold, marginLeft: "auto" }}>{t("devices.online")}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 4, fontFamily: "monospace" }}>
                  {shortId(d.deviceId)}
                </div>
                <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 2 }}>
                  {t("devices.seen", { last: formatMessageTime(d.lastSeenMs), first: formatMessageTime(d.firstSeenMs) })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 20 }}>
        {t("devices.footer")}
      </p>
    </div>
  );
}
