/**
 * 连接质量统计。
 *
 * 对应中继技术文档第 9、11 节关心的问题：手机网络下延迟到底多少、掉不掉线。
 * 这些是在国内移动网络排查问题时唯一有用的东西——"能不能连上"很容易看，
 * "连上之后好不好用"必须量出来。
 */

/** 保留最近这么多次测量。够看出趋势，又不会无限占内存。 */
export const MAX_SAMPLES = 60;

export interface LatencyStats {
  samples: number[];
  latestMs: number | null;
  averageMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

export const EMPTY_LATENCY_STATS: LatencyStats = {
  samples: [],
  latestMs: null,
  averageMs: null,
  minMs: null,
  maxMs: null,
};

export function addLatencySample(stats: LatencyStats, rttMs: number): LatencyStats {
  const samples = [...stats.samples, rttMs].slice(-MAX_SAMPLES);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    samples,
    latestMs: rttMs,
    averageMs: Math.round(sum / samples.length),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

/**
 * 用平均延迟给一个粗略评级。阈值是按"聊天够不够跟手"定的，不是按通话——
 * 通话对抖动的要求高得多，那需要另外一套指标。
 */
export function qualityFor(stats: LatencyStats): ConnectionQuality {
  if (stats.averageMs === null) return "unknown";
  if (stats.averageMs < 200) return "good";
  if (stats.averageMs < 600) return "fair";
  return "poor";
}

export function describeQuality(quality: ConnectionQuality): string {
  switch (quality) {
    case "good":
      return "良好";
    case "fair":
      return "一般";
    case "poor":
      return "较差";
    default:
      return "尚未测量";
  }
}

export interface DisconnectRecord {
  atMs: number;
  /** 到重新连上花了多久；还没连上就是 null */
  recoveredAfterMs: number | null;
}

/** 记录一次掉线。同样只保留最近若干条。 */
export function recordDisconnect(history: DisconnectRecord[], atMs: number): DisconnectRecord[] {
  return [...history, { atMs, recoveredAfterMs: null }].slice(-MAX_SAMPLES);
}

/** 重新连上时，补上最近那次掉线的恢复耗时 */
export function recordReconnect(history: DisconnectRecord[], atMs: number): DisconnectRecord[] {
  if (history.length === 0) return history;
  const last = history[history.length - 1]!;
  if (last.recoveredAfterMs !== null) return history;
  return [...history.slice(0, -1), { ...last, recoveredAfterMs: atMs - last.atMs }];
}
