import { useEffect, useRef, useState } from "react";
import { colors, touchTarget } from "@secureinchat/ui";
import { describeCallState, type CallKind, type CallStateInfo } from "@secureinchat/webrtc";

export interface CallScreenProps {
  kind: CallKind;
  info: CallStateInfo;
  peerLabel: string;
  localStream?: MediaStream | undefined;
  remoteStream?: MediaStream | undefined;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: (muted: boolean) => void;
  onToggleCamera: (enabled: boolean) => void;
  onDismiss: () => void;
  /** 没配 TURN 时如实提示：跨运营商/跨网络大概率接不通，不要让用户以为是自己的问题 */
  hasTurn?: boolean | undefined;
}

function CircleButton({
  label,
  emoji,
  background,
  onClick,
}: {
  label: string;
  emoji: string;
  background: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 64,
        height: 64,
        minWidth: touchTarget.minDp,
        minHeight: touchTarget.minDp,
        borderRadius: "50%",
        background,
        border: "none",
        boxShadow: "none",
        fontSize: 24,
        cursor: "pointer",
      }}
    >
      {emoji}
    </button>
  );
}

/** 通话界面：来电、呼出、通话中、已结束都在这一个屏幕里，按状态切换。 */
export function CallScreen({
  kind,
  info,
  peerLabel,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onDismiss,
  hasTurn,
}: CallScreenProps) {
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(kind === "video");
  const [elapsedSec, setElapsedSec] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  /**
   * 把流挂到 <video>/<audio> 上。
   *
   * 依赖里必须带上 info.state：视频元素只在通话界面切换到相应状态后才挂载，
   * 而流可能在那之前就到了。只依赖 stream 的话，effect 跑的时候 ref 还是空的，
   * 等元素挂载好又不会重跑——srcObject 永远没被赋值，画面就是一个播放按钮占位图。
   *
   * 赋值之后还要显式 play()：Android WebView 对自动播放的限制比桌面浏览器严，
   * autoPlay 属性不总是够。play() 被拒绝时忽略即可，用户点一下也能播。
   */
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    el.srcObject = localStream;
    void el.play().catch(() => undefined);
  }, [localStream, info.state, cameraOn]);

  useEffect(() => {
    if (!remoteStream) return;
    const video = remoteVideoRef.current;
    if (video) {
      video.srcObject = remoteStream;
      void video.play().catch(() => undefined);
    }
    const audio = remoteAudioRef.current;
    if (audio) {
      audio.srcObject = remoteStream;
      void audio.play().catch(() => undefined);
    }
  }, [remoteStream, info.state]);

  // 通话计时——只在真正接通后开始走
  useEffect(() => {
    if (info.state !== "connected") return;
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [info.state]);

  const durationLabel = `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`;
  const isVideo = kind === "video";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.ivory,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
      }}
    >
      {isVideo && info.state === "connected" ? (
        <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            aria-label="对方画面"
            style={{ width: "100%", borderRadius: 16, background: "#000" }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            aria-label="本机画面"
            style={{ position: "absolute", right: 8, bottom: 8, width: 96, borderRadius: 10, background: "#000" }}
          />
        </div>
      ) : (
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: colors.sageMint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            color: colors.deepInkGreen,
          }}
          aria-hidden="true"
        >
          {isVideo ? "🎥" : "📞"}
        </div>
      )}

      {/* 语音通话也需要一个音频输出节点，否则听不到对方 */}
      {!isVideo || info.state !== "connected" ? (
        <audio ref={remoteAudioRef} autoPlay aria-label="对方语音" style={{ display: "none" }} />
      ) : null}

      <span style={{ fontSize: 18, fontWeight: 500, color: colors.textPrimary }}>{peerLabel}</span>
      <span style={{ fontSize: 13, color: "#8A8A82" }}>
        {info.state === "connected" ? durationLabel : describeCallState(info, kind)}
      </span>

      {hasTurn === false && info.state !== "connected" && info.state !== "ended" ? (
        <span style={{ fontSize: 11, color: colors.wheatGold, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
          未配置 TURN 中继服务：双方处于不同运营商网络（如移动 ↔ 电信）时可能无法接通
        </span>
      ) : null}

      <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
        {info.state === "incoming" ? (
          <>
            <CircleButton label="拒绝" emoji="📵" background="#C05" onClick={onReject} />
            <CircleButton label="接听" emoji="📞" background={colors.deepInkGreen} onClick={onAccept} />
          </>
        ) : info.state === "ended" ? (
          <CircleButton label="关闭" emoji="✕" background={colors.sageMint} onClick={onDismiss} />
        ) : (
          <>
            <CircleButton
              label={muted ? "取消静音" : "静音"}
              emoji={muted ? "🔇" : "🎙️"}
              background={colors.sageMint}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                onToggleMute(next);
              }}
            />
            {isVideo ? (
              <CircleButton
                label={cameraOn ? "关闭摄像头" : "开启摄像头"}
                emoji={cameraOn ? "🎥" : "🚫"}
                background={colors.sageMint}
                onClick={() => {
                  const next = !cameraOn;
                  setCameraOn(next);
                  onToggleCamera(next);
                }}
              />
            ) : null}
            <CircleButton label="挂断" emoji="📵" background="#C05" onClick={onHangup} />
          </>
        )}
      </div>
    </div>
  );
}
