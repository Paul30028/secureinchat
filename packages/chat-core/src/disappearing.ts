/**
 * 阅后即焚（消息定时消失）的公共逻辑。
 *
 * 计时从「本机收到/发出这条消息的时刻」开始，不用 sentAtMs——对方时钟不准
 * 会导致一收到就删，离线补发的消息也会一到就过期。
 *
 * 这个模块只做纯计算，不碰 UI、不碰存储，方便测试和复用。
 */

/** 可选的消失时长：关、5 分钟、1 小时、1 天、7 天。 */
export const DISAPPEAR_OPTIONS_MS = [
  0,
  5 * 60_000,
  3_600_000,
  86_400_000,
  7 * 86_400_000,
] as const;

/** 消息里允许携带的最短消失时长：1 分钟。 */
const MIN_EXPIRES_MS = 60_000;
/** 消息里允许携带的最长消失时长：7 天。 */
const MAX_EXPIRES_MS = 7 * 86_400_000;

/**
 * 把信封里带过来的 expiresInMs 校验成可用的值。
 * 必须是有限正整数，且在 [60_000, 7 天] 范围内；否则当作没有（不删、不报错）。
 * 老客户端发的消息没有这个字段，返回 undefined，照常显示。
 */
export function sanitizeExpiresInMs(v: unknown): number | undefined {
  // 只收整数：小数说明对端写错了，当作没有，而不是替它四舍五入。
  if (typeof v !== "number" || !Number.isInteger(v)) return undefined;
  if (v < MIN_EXPIRES_MS || v > MAX_EXPIRES_MS) return undefined;
  return v;
}

/**
 * 本机收到/发出这条消息的时刻 + 时长 = 到期时间。没有时长就不设到期。
 */
export function expiresAtFor(
  receivedAtMs: number,
  expiresInMs: number | undefined
): number | undefined {
  if (expiresInMs === undefined) return undefined;
  return receivedAtMs + expiresInMs;
}

/**
 * 按当前时刻把消息分成「留着」和「已过期」两堆。
 * 到期时间缺失或不是有限数字的当作不过期（老消息、损坏数据）。
 */
export function partitionExpired<T extends { expiresAtMs?: number | undefined }>(
  items: T[],
  nowMs: number
): { keep: T[]; expired: T[] } {
  const keep: T[] = [];
  const expired: T[] = [];
  for (const item of items) {
    const at = item.expiresAtMs;
    if (typeof at === "number" && Number.isFinite(at) && at <= nowMs) {
      expired.push(item);
    } else {
      keep.push(item);
    }
  }
  return { keep, expired };
}

/**
 * 最早一条的到期时间，给定时器用。没有需要定时的消息时返回 undefined。
 * 调用方拿它减当前时间就是 setTimeout 的延迟；最少要等 1 秒，
 * 避免到期时间在过去（时钟回拨等）时立刻疯狂重排。
 */
export function nextExpiryMs<T extends { expiresAtMs?: number | undefined }>(
  items: T[]
): number | undefined {
  let earliest: number | undefined;
  for (const item of items) {
    const at = item.expiresAtMs;
    if (typeof at !== "number" || !Number.isFinite(at)) continue;
    if (earliest === undefined || at < earliest) earliest = at;
  }
  return earliest;
}
