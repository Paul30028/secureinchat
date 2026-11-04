import { useState } from "react";
import { colors, radii, touchTarget, Button } from "@secureinchat/ui";
import {
  qualityFor,
  describeQuality,
  type LatencyStats,
  type DisconnectRecord,
  probeRelay,
  type ConnectionStatus,
} from "@secureinchat/chat-core";
import {
  probeIceServers,
  detectMediaEncryptionSupport,
  describeMediaEncryptionSupport,
  MAX_MESH_PARTICIPANTS,
  type IceConfiguration,
} from "@secureinchat/webrtc";
import { useT, useLocale } from "../i18n";

export interface ConnectionDiagnosticsScreenProps {
  relayUrl: string;
  iceConfig: IceConfiguration;
  status: ConnectionStatus;
  latency: LatencyStats;
  disconnects: DisconnectRecord[];
  onBack: () => void;
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `0.5px solid ${colors.sageMint}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#8A8A82" }}>{label}</span>
        <span style={{ fontSize: 14, color: colors.textPrimary, textAlign: "right", wordBreak: "break-all" }}>
          {value}
        </span>
      </div>
      {hint ? <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

// 状态到词条键的映射。放在组件外只是键名，不调用 t。
const STATUS_KEY: Record<ConnectionStatus, string> = {
  connected: "connectionDiagnostics.statusConnected",
  connecting: "connectionDiagnostics.statusConnecting",
  reconnecting: "connectionDiagnostics.statusReconnecting",
  disconnected: "connectionDiagnostics.statusDisconnected",
};

/**
 * 连接诊断。
 *
 * 这一页的存在理由很具体：国内移动网络下"能连上"和"用起来顺不顺"是两回事，
 * 出问题时需要能分清是连接建立慢、还是连上之后消息往返慢、还是频繁掉线。
 * 没有这些数字，排查只能靠猜。
 */
export function ConnectionDiagnosticsScreen({
  relayUrl,
  iceConfig,
  status,
  latency,
  disconnects,
  onBack,
}: ConnectionDiagnosticsScreenProps) {
  const t = useT();
  const locale = useLocale();
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [probeOk, setProbeOk] = useState(false);

  async function runProbe() {
    setProbing(true);
    setProbeMessage(null);
    try {
      const result = await probeRelay(relayUrl);
      setProbeOk(result.ok);
      setProbeMessage(
        result.ok
          ? t("connectionDiagnostics.probeOk", { ms: result.elapsedMs })
          : t("connectionDiagnostics.probeFail", { reason: result.reason })
      );
    } finally {
      setProbing(false);
    }
  }

  const [turnProbing, setTurnProbing] = useState(false);
  const [turnMessage, setTurnMessage] = useState<string | null>(null);
  const [turnOk, setTurnOk] = useState(false);

  /**
   * 真的建一个 RTCPeerConnection 收集一轮候选，看有没有 relay 类型。
   * 没有 relay 就意味着跨运营商通话必定失败——与其等真打电话时才发现，
   * 不如在这里一次问清楚。
   */
  async function runTurnProbe() {
    setTurnProbing(true);
    setTurnMessage(null);
    try {
      const result = await probeIceServers(iceConfig);
      if (!result.ok) {
        setTurnOk(false);
        setTurnMessage(t("connectionDiagnostics.turnProbeError", { error: result.error }));
        return;
      }
      const separator = t("connectionDiagnostics.candidateSeparator");
      const types = result.candidateTypes.join(separator);
      setTurnOk(result.sawRelayCandidate);
      setTurnMessage(
        result.sawRelayCandidate
          ? t("connectionDiagnostics.turnRelayOk", { types })
          : t("connectionDiagnostics.turnRelayMissing", {
              types: types || t("connectionDiagnostics.turnNone"),
            })
      );
    } finally {
      setTurnProbing(false);
    }
  }

  // 十几人会议要 SFU；能不能同时保住"服务器看不到内容"取决于这个能力。
  // 在买机器、部署 SFU 之前先知道答案，而不是做完才发现跑不了。
  const mediaEncryption = detectMediaEncryptionSupport();

  const quality = qualityFor(latency);
  const recovered = disconnects.filter((d) => d.recoveredAfterMs !== null);
  const avgRecovery =
    recovered.length > 0
      ? Math.round(recovered.reduce((a, d) => a + (d.recoveredAfterMs ?? 0), 0) / recovered.length / 1000)
      : null;

  const numberFormat = new Intl.NumberFormat(locale);
  const fmt = (n: number): string => numberFormat.format(n);

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={onBack}
        aria-label={t("connectionDiagnostics.back")}
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
        {t("connectionDiagnostics.backArrow")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>
        {t("connectionDiagnostics.title")}
      </h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 12px" }}>
        {t("connectionDiagnostics.subtitle")}
      </p>

      <div
        style={{
          background: `${colors.sageMint}33`,
          borderRadius: radii.cardMedium,
          padding: "14px 16px",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 12, color: "#8A8A82" }}>{t("connectionDiagnostics.currentQuality")}</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: colors.deepInkGreen, margin: "4px 0" }}>
          {describeQuality(quality)}
        </div>
        <div style={{ fontSize: 12, color: "#8A8A82" }}>
          {latency.latestMs !== null
            ? t("connectionDiagnostics.latestRtt", { ms: fmt(latency.latestMs) })
            : t("connectionDiagnostics.awaitingHeartbeat")}
        </div>
      </div>

      {/* 主动测试。之前这一页只显示"当前状态"，连不上的时候它也是空的——
          最需要它的时候什么都不说。 */}
      <div style={{ marginBottom: 12 }}>
        <Button variant="primary" onClick={() => void runProbe()} disabled={probing} style={{ width: "100%" }}>
          {probing ? t("connectionDiagnostics.probing") : t("connectionDiagnostics.testConnection")}
        </Button>
        {probeMessage ? (
          <p
            role="status"
            style={{
              fontSize: 12,
              color: probeOk ? colors.deepInkGreen : "#A33",
              margin: "8px 0 0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {probeMessage}
          </p>
        ) : null}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Button variant="secondary" onClick={() => void runTurnProbe()} disabled={turnProbing} style={{ width: "100%" }}>
          {turnProbing ? t("connectionDiagnostics.turnProbing") : t("connectionDiagnostics.turnProbe")}
        </Button>
        {turnMessage ? (
          <p
            role="status"
            style={{
              fontSize: 12,
              color: turnOk ? colors.deepInkGreen : "#A33",
              margin: "8px 0 0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {turnMessage}
          </p>
        ) : null}
      </div>

      <Row label={t("connectionDiagnostics.rowServer")} value={relayUrl} />
      <Row
        label={t("connectionDiagnostics.rowGroupCall")}
        value={
          mediaEncryption.supported
            ? t("connectionDiagnostics.groupCallEncrypted")
            : t("connectionDiagnostics.groupCallMesh", { max: fmt(MAX_MESH_PARTICIPANTS) })
        }
        hint={describeMediaEncryptionSupport(mediaEncryption)}
      />
      <Row
        label={t("connectionDiagnostics.rowCallRoute")}
        value={
          iceConfig.hasTurn
            ? t("connectionDiagnostics.callRouteTurn")
            : t("connectionDiagnostics.callRouteStunOnly")
        }
        hint={iceConfig.hasTurn ? undefined : t("connectionDiagnostics.callRouteStunHint")}
      />
      <Row label={t("connectionDiagnostics.rowConnectionStatus")} value={t(STATUS_KEY[status])} />
      <Row
        label={t("connectionDiagnostics.rowMessageRtt")}
        value={
          latency.averageMs !== null
            ? t("connectionDiagnostics.rttAverage", { ms: fmt(latency.averageMs) })
            : t("connectionDiagnostics.rttNotMeasured")
        }
        hint={
          latency.minMs !== null
            ? t("connectionDiagnostics.rttHint", {
                min: fmt(latency.minMs),
                max: fmt(latency.maxMs ?? 0),
                count: fmt(latency.samples.length),
              })
            : undefined
        }
      />
      <Row
        label={t("connectionDiagnostics.rowDisconnects")}
        value={t("connectionDiagnostics.disconnectCount", { count: fmt(disconnects.length) })}
        hint={
          avgRecovery !== null
            ? t("connectionDiagnostics.disconnectRecoveryHint", { seconds: fmt(avgRecovery) })
            : t("connectionDiagnostics.disconnectSessionHint")
        }
      />

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 16 }}>
        {t("connectionDiagnostics.footnote")}
      </p>
    </div>
  );
}
