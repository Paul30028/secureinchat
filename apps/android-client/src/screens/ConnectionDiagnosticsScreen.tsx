import { useState } from "react";
import { colors, radii, touchTarget, Button } from "@secureinchat/ui";
import {
  qualityFor,
  type LatencyStats,
  type DisconnectRecord,
  probeRelay,
  type ConnectionStatus,
} from "@secureinchat/chat-core";
import {
  probeIceServers,
  detectMediaEncryptionSupport,
  MAX_MESH_PARTICIPANTS,
  type IceConfiguration,
} from "@secureinchat/webrtc";
import { t } from "../i18n";
import { connectionStatusText, mediaEncryptionText, probeFailureText, qualityText } from "../i18n/labels";

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
        result.ok ? t("diag.probeOk", { ms: result.elapsedMs }) : t("diag.probeFailed", { reason: probeFailureText(result.code) })
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
        setTurnMessage(t("diag.turnCheckFailed", { reason: result.error }));
        return;
      }
      setTurnOk(result.sawRelayCandidate);
      setTurnMessage(
        result.sawRelayCandidate
          ? t("diag.turnOk", { types: result.candidateTypes.join(t("common.listSeparator")) })
          : t("diag.turnMissing", { types: result.candidateTypes.join(t("common.listSeparator")) || t("common.none") })
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

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>{t("me.diagnostics")}</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 12px" }}>
        {t("diag.intro")}
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
        <div style={{ fontSize: 12, color: "#8A8A82" }}>{t("diag.quality")}</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: colors.deepInkGreen, margin: "4px 0" }}>
          {qualityText(quality)}
        </div>
        <div style={{ fontSize: 12, color: "#8A8A82" }}>
          {latency.latestMs !== null ? t("diag.latestRtt", { ms: latency.latestMs }) : t("diag.waitingHeartbeat")}
        </div>
      </div>

      {/* 主动测试。之前这一页只显示"当前状态"，连不上的时候它也是空的——
          最需要它的时候什么都不说。 */}
      <div style={{ marginBottom: 12 }}>
        <Button variant="primary" onClick={() => void runProbe()} disabled={probing} style={{ width: "100%" }}>
          {probing ? t("diag.testing") : t("diag.test")}
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
          {turnProbing ? t("diag.turnTesting") : t("diag.turnTest")}
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

      <Row label={t("diag.server")} value={relayUrl} />
      <Row
        label={t("diag.conference")}
        value={mediaEncryption.supported ? t("diag.conferenceE2ee") : t("diag.conferenceMax", { count: MAX_MESH_PARTICIPANTS })}
        hint={mediaEncryptionText(mediaEncryption)}
      />
      <Row
        label={t("diag.callRoute")}
        value={iceConfig.hasTurn ? t("diag.turnConfigured") : t("diag.stunOnly")}
        hint={iceConfig.hasTurn ? undefined : t("diag.noTurnHint")}
      />
      <Row label={t("diag.status")} value={connectionStatusText(status)} />
      <Row
        label={t("diag.rtt")}
        value={latency.averageMs !== null ? t("diag.avgMs", { ms: latency.averageMs }) : t("quality.unknown")}
        hint={
          latency.minMs !== null ? t("diag.rttRange", { min: latency.minMs, max: latency.maxMs ?? latency.minMs, count: latency.samples.length }) : undefined
        }
      />
      <Row
        label={t("diag.disconnects")}
        value={t("diag.times", { count: disconnects.length })}
        hint={avgRecovery !== null ? t("diag.avgRecovery", { count: avgRecovery }) : t("diag.thisRun")}
      />

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 16 }}>
        {t("diag.footer")}
      </p>
    </div>
  );
}
