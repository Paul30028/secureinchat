import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";

/**
 * 群里见过的设备。
 *
 * ⚠️ 这份名单的来源必须说清楚：中继的设备注册表是内存态的，重启就清空，
 * 而且它按设计不保存"谁在什么时候上过线"的历史。所以这里记录的是
 * **本机自己观察到的**——通过在线状态推送和收到的消息累积出来的。
 *
 * 这意味着：
 * - 从没和你同时在线、也没发过消息的设备，你不会看到
 * - 换了新手机之后这份名单是空的，要重新积累
 *
 * 它能回答的问题是"这个群里我见过哪些设备、最近一次是什么时候"，
 * 这对判断"是不是有不认识的设备在里面"够用了。
 */

const KEY_PREFIX = "devices:";

export interface KnownDevice {
  deviceId: string;
  /** 该设备发消息时带的昵称，可能没有 */
  displayName?: string | undefined;
  firstSeenMs: number;
  lastSeenMs: number;
}

export function storageKeyForDevices(groupId: string): string {
  return `${KEY_PREFIX}${groupId}`;
}

export async function loadKnownDevices(
  store: EncryptedKeyValueStore,
  groupId: string
): Promise<KnownDevice[]> {
  try {
    const bytes = await store.get(storageKeyForDevices(groupId));
    if (!bytes) return [];
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? (parsed as KnownDevice[]) : [];
  } catch {
    return [];
  }
}

export async function saveKnownDevices(
  store: EncryptedKeyValueStore,
  groupId: string,
  devices: KnownDevice[]
): Promise<void> {
  await store.set(storageKeyForDevices(groupId), new TextEncoder().encode(JSON.stringify(devices)));
}

/**
 * 记录一次"见到"。已知设备更新 lastSeen 和昵称，新设备追加。
 * firstSeen 保留原值——它回答的是"这个设备是什么时候第一次出现的"，
 * 被覆盖就失去意义了。
 */
export function markDeviceSeen(
  devices: KnownDevice[],
  deviceId: string,
  atMs: number,
  displayName?: string | undefined
): KnownDevice[] {
  const existing = devices.find((d) => d.deviceId === deviceId);
  if (!existing) {
    return [...devices, { deviceId, displayName, firstSeenMs: atMs, lastSeenMs: atMs }];
  }
  return devices.map((d) =>
    d.deviceId === deviceId
      ? { ...d, lastSeenMs: atMs, displayName: displayName ?? d.displayName }
      : d
  );
}

/** 最近见过的排前面——要找"有没有陌生设备"，最近的最相关 */
export function sortByRecency(devices: KnownDevice[]): KnownDevice[] {
  return [...devices].sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}

/** 轮换群密钥之后，旧设备就再也读不到新消息了——名单该清掉重新积累 */
export function forgetAllDevices(): KnownDevice[] {
  return [];
}
