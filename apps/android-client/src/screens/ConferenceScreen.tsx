import { colors, radii, touchTarget, MicIcon } from "@secureinchat/ui";
import {
  activeCount,
  MAX_MESH_PARTICIPANTS,
  type ConferenceState,
  type Participant,
} from "@secureinchat/webrtc";

export interface ConferenceScreenProps {
  state: ConferenceState;
  groupName: string;
  myNickname?: string | undefined;
  elapsedSec: number;
  onToggleSelfMute: () => void;
  onLeave: () => void;
}

function stateLabel(p: Participant): string {
  switch (p.state) {
    case "inviting":
      return "邀请中";
    case "connecting":
      return "接通中";
    case "connected":
      return p.muted ? "已静音" : "通话中";
    case "failed":
      return "连接失败";
    default:
      return "已离开";
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
          语音会议 · {count}/{MAX_MESH_PARTICIPANTS} 人
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
          <span style={{ fontSize: 14, color: colors.textPrimary }}>{myNickname ?? "我"}</span>
          <span style={{ fontSize: 11, color: colors.deepInkGreen }}>本机</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: state.selfMuted ? "#A33" : "#8A8A82",
            }}
          >
            {state.selfMuted ? "已静音" : "通话中"}
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
              {p.displayName ?? `设备 ${shortId(p.deviceId)}`}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: p.state === "connected" ? "#8A8A82" : colors.wheatGold,
              }}
            >
              {stateLabel(p)}
            </span>
          </div>
        ))}

        {inCall.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: "#9A9A94", lineHeight: 1.8 }}>
            正在等其他人加入。
            <br />
            群里在线的人会看到会议邀请。
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 24, paddingTop: 16 }}>
        <button
          onClick={onToggleSelfMute}
          aria-label={state.selfMuted ? "取消静音" : "静音"}
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
          aria-label="离开会议"
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
          离开
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#9A9A94", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
        语音只在参与者之间传输，服务器听不到。最多 {MAX_MESH_PARTICIPANTS} 人。
      </p>
    </div>
  );
}
