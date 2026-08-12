import { colors, radii, touchTarget } from "@secureinchat/ui";
import {
  qualityFor,
  describeQuality,
  type LatencyStats,
  type DisconnectRecord,
  type ConnectionStatus,
} from "@secureinchat/chat-core";

export interface ConnectionDiagnosticsScreenProps {
  relayUrl: string;
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

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "已连接",
  connecting: "连接中",
  reconnecting: "重连中",
  disconnected: "已断开",
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
  status,
  latency,
  disconnects,
  onBack,
}: ConnectionDiagnosticsScreenProps) {
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

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>连接诊断</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 12px" }}>
        网络不稳时，这些数字能分清是连不上、还是连上了但慢。
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
        <div style={{ fontSize: 12, color: "#8A8A82" }}>当前连接质量</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: colors.deepInkGreen, margin: "4px 0" }}>
          {describeQuality(quality)}
        </div>
        <div style={{ fontSize: 12, color: "#8A8A82" }}>
          {latency.latestMs !== null ? `最近一次往返 ${latency.latestMs} 毫秒` : "等待心跳测量..."}
        </div>
      </div>

      <Row label="服务器" value={relayUrl} />
      <Row label="连接状态" value={STATUS_LABEL[status]} />
      <Row
        label="消息往返延迟"
        value={latency.averageMs !== null ? `平均 ${latency.averageMs} 毫秒` : "尚未测量"}
        hint={
          latency.minMs !== null ? `最快 ${latency.minMs} / 最慢 ${latency.maxMs} 毫秒，取最近 ${latency.samples.length} 次心跳` : undefined
        }
      />
      <Row
        label="掉线次数"
        value={`${disconnects.length} 次`}
        hint={avgRecovery !== null ? `平均 ${avgRecovery} 秒后自动恢复` : "本次运行期间统计"}
      />

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 16 }}>
        延迟是应用层心跳测出来的真实消息往返时间，不是首次连接耗时——首次连接慢
        但连上之后往返快，聊天体验依然是好的。统计只覆盖本次运行，重启后清零。
      </p>
    </div>
  );
}
