import { colors, radii, touchTarget, MicIcon } from "@secureinchat/ui";
import {
  activeCount,
  MAX_MESH_PARTICIPANTS,
  type ConferenceState,
  type Participant,
} from "@secureinchat/webrtc";
import { useT } from "../i18n";

export interface ConferenceScreenProps {
  state: ConferenceState;
  groupName: string;
  myNickname?: string | undefined;
  elapsedSec: number;
  onToggleSelfMute: () => void;
  onLeave: () => void;
}

// 状态标签的取值键，在组件内用 t 翻译。
function stateLabelKey(p: Participant): string {
  switch (p.state) {
    case "inviting":
      return "conference.stateInviting";
    case "connecting":
      return "conference.stateConnecting";
    case "connected":
      return p.muted ? "conference.muted" : "conference.inCall";
    case "failed":
      return "conference.stateFailed";
    default:
      return "conference.stateLeft";
  }
}

function shortId(deviceId: string): string {
  return deviceId.replace(/^device-/, "").slice(0, 6);
}

/**
 * 多人语音会议。
 *
 * 只做语音——mesh 下每台设备要同时编解码 N-1 路，视频在这个架构下到不了
 * 几个人就会卡死。视频会议需要 SFU，那是另一套架构。
 */
export function ConferenceScreen({
  state,
  groupName,
  myNickname,
  elapsedSec,
  onToggleSelfMute,
  onLeave,
}: ConferenceScreenProps) {
  const t = useT();
  const duration = `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`;
  const inCall = state.participants.filter((p) => p.state !== "left");
  const count = activeCount(state);

  return (
    <div
      style={{
        height: "100%",
        background: colors.ivory,
        display: "flex",
        flexDirection: "column",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary }}>{groupName}</div>
        <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 4 }}>
          {t("conference.participantCount", { count, max: MAX_MESH_PARTICIPANTS })}
        </div>
        <div style={{ fontSize: 13, color: colors.deepInkGreen, marginTop: 6 }}>{duration}</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 12 }}>
        {/* 自己 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            border: `0.5px solid ${colors.sageMint}`,
            borderRadius: radii.cardSmall,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 14, color: colors.textPrimary }}>
            {myNickname ?? t("conference.selfNicknameFallback")}
          </span>
          <span style={{ fontSize: 11, color: colors.deepInkGreen }}>{t("conference.selfTag")}</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: state.selfMuted ? "#A33" : "#8A8A82",
            }}
          >
            {state.selfMuted ? t("conference.muted") : t("conference.inCall")}
          </span>
        </div>

        {inCall.map((p) => (
          <div
            key={p.deviceId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              border: `0.5px solid ${colors.sageMint}`,
              borderRadius: radii.cardSmall,
              marginBottom: 8,
              opacity: p.state === "failed" ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 14, color: colors.textPrimary }}>
              {p.displayName ?? t("conference.deviceFallback", { id: shortId(p.deviceId) })}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: p.state === "connected" ? "#8A8A82" : colors.wheatGold,
              }}
            >
              {t(stateLabelKey(p))}
            </span>
          </div>
        ))}

        {inCall.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: "#9A9A94", lineHeight: 1.8 }}>
            {t("conference.waitingTitle")}
            <br />
            {t("conference.waitingHint")}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 24, paddingTop: 16 }}>
        <button
          onClick={onToggleSelfMute}
          aria-label={state.selfMuted ? t("conference.unmute") : t("conference.mute")}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            border: "none",
            boxShadow: "none",
            background: state.selfMuted ? colors.wheatGold : colors.sageMint,
            color: colors.ivory,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MicIcon size={26} color={state.selfMuted ? colors.ivory : colors.deepInkGreen} />
        </button>

        <button
          onClick={onLeave}
          aria-label={t("conference.leaveAriaLabel")}
          style={{
            minHeight: touchTarget.minDp,
            width: 64,
            height: 64,
            borderRadius: 32,
            border: "none",
            boxShadow: "none",
            background: "#C05",
            color: colors.ivory,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {t("conference.leave")}
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#9A9A94", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
        {t("conference.privacyNote", { max: MAX_MESH_PARTICIPANTS })}
      </p>
    </div>
  );
}
