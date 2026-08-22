import { getDeviceStore } from "./deviceIdentity";
import { restoreAdminKeyFromRecoveryCode } from "@secureinchat/crypto-core";

/**
 * 管理员私钥的本地保管。
 *
 * 存的是恢复码那串文本（JWK），走加密存储（设备主密钥加密后落盘），用的时候
 * 再导入成不可导出的 CryptoKey。
 *
 * 之前是把 CryptoKey 对象直接放进 IndexedDB。那依赖结构化克隆支持 CryptoKey，
 * 老版本 Android WebView 不一定支持——真机上一失败，建群流程就整个断在这里，
 * 群进不去、管理员入口也不出现。存文本没有这个问题。
 *
 * 换设备就没有这把钥匙，需要用恢复码找回（「我的」→ 恢复管理员权限）。
 */

function storageKey(groupId: string): string {
  return `admin-key:${groupId}`;
}

export async function saveAdminKey(groupId: string, recoveryCode: string): Promise<void> {
  const store = await getDeviceStore();
  await store.set(storageKey(groupId), new TextEncoder().encode(recoveryCode));
}

export async function loadAdminKey(groupId: string): Promise<CryptoKey | undefined> {
  try {
    const store = await getDeviceStore();
    const bytes = await store.get(storageKey(groupId));
    if (!bytes) return undefined;
    const restored = await restoreAdminKeyFromRecoveryCode(new TextDecoder().decode(bytes));
    return restored.privateKey;
  } catch {
    // 读不出来就是没有——不该让应用因此起不来
    return undefined;
  }
}

/** 这台设备是不是这个群的管理员——有密钥才是，和界面上有没有解锁无关 */
export async function isGroupAdmin(groupId: string): Promise<boolean> {
  return (await loadAdminKey(groupId)) !== undefined;
}
