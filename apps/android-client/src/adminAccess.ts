import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 管理员入口。
 *
 * 按原始需求第十三节：连续点击版本号 7 次显现管理员入口。这不是安全机制——
 * 任何人都能点 7 下——而是**把发布功能从日常界面里藏起来**：绝大多数人打开
 * 公告栏是来看的，不该看到一堆发布表单。
 *
 * 真正的权限校验（服务端验证谁有资格发公告）还没有实现，所以这里必须说清楚：
 * 解锁之后发出去的公告，群里任何人的客户端都会接受。这是已知缺口，不是
 * 已完成的管理员体系。
 */

const ADMIN_KEY = "admin:unlocked";

export const TAPS_TO_UNLOCK = 7;
/** 超过这个间隔就重新计数——避免几天内零星点到 7 次也解锁 */
export const TAP_WINDOW_MS = 3000;

const backend = new IndexedDbStorageBackend();

export async function isAdminUnlocked(): Promise<boolean> {
  try {
    const bytes = await backend.get(ADMIN_KEY);
    return bytes ? new TextDecoder().decode(bytes) === "1" : false;
  } catch {
    return false;
  }
}

export async function setAdminUnlocked(unlocked: boolean): Promise<void> {
  if (unlocked) {
    await backend.set(ADMIN_KEY, new TextEncoder().encode("1"));
  } else {
    await backend.delete(ADMIN_KEY);
  }
}

export interface TapState {
  count: number;
  lastTapAtMs: number;
}

export const INITIAL_TAP_STATE: TapState = { count: 0, lastTapAtMs: 0 };

export interface TapResult {
  state: TapState;
  unlocked: boolean;
  /** 还差几次——到第 4 次开始给一点反馈，否则用户不知道自己在触发什么 */
  remaining: number;
}

export function registerTap(prev: TapState, nowMs: number = Date.now()): TapResult {
  const withinWindow = nowMs - prev.lastTapAtMs <= TAP_WINDOW_MS;
  const count = withinWindow ? prev.count + 1 : 1;
  const unlocked = count >= TAPS_TO_UNLOCK;

  return {
    state: unlocked ? INITIAL_TAP_STATE : { count, lastTapAtMs: nowMs },
    unlocked,
    remaining: Math.max(0, TAPS_TO_UNLOCK - count),
  };
}
