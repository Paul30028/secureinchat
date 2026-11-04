import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";
import { loadJoinedGroups, removeGroup, saveJoinedGroups } from "./groupStore";
import { storageKeyForGroupMessages } from "./messageStore";
import { storageKeyForDevices } from "./knownDevices";
import { storageKeyForGroupIdentity } from "./groupIdentity";
import { assertValidGroupId } from "./groupId";
export { InvalidGroupIdError } from "./groupId";

/**
 * 把一个群在本机留下的东西删干净（包 1 / P1a）。
 *
 * 为什么需要它：原来的退群只删群列表、消息和设备名单，留下了
 * `group:<gid>:epoch:<n>`（每个 epoch 的原始群密钥）和 `admin-key:<gid>`
 * （管理员恢复码，等同管理员身份）。手机被拿去做取证时，这些就是可以拿走的东西。
 *
 * 退群、空手过境（P1b）都走这里。删除顺序：先删密钥，最后才把群从列表里拿掉——
 * 中途断电的话，群还在列表里，用户能看到并且可以再删一次（本函数可重复调用）。
 *
 * 边界：IndexedDB 的删除是逻辑删除，数据库文件空闲页里可能残留密文；
 * 它们由设备主密钥加密，主密钥还在时理论上可解。每群独立数据密钥（P1e）才是彻底的办法。
 */

export function storageKeyForAdminKey(groupId: string): string {
  return `admin-key:${groupId}`;
}

/** 某个群所有 epoch 密钥的键前缀。带结尾冒号，避免 "g1" 匹配到 "g10"。 */
export function epochKeyPrefix(groupId: string): string {
  return `group:${groupId}:`;
}

export interface PurgeReport {
  groupId: string;
  /** 实际删掉的键（删除前确实存在的） */
  deletedKeys: string[];
  /** 删完之后，存储里仍然带这个群 id 的键。正常应为空；不为空说明有新的存储位置没登记到这里。 */
  remainingKeys: string[];
}

function belongsToGroup(key: string, groupId: string): boolean {
  // 所有群作用域的键都是 "<前缀>:<gid>" 或 "<前缀>:<gid>:<后缀>" 的形式
  return key.split(":").includes(groupId);
}

export async function purgeGroupLocalData(
  store: EncryptedKeyValueStore,
  groupId: string
): Promise<PurgeReport> {
  assertValidGroupId(groupId);

  const existing = new Set(await store.listKeys());
  const targets = [
    // 1. 秘密先删：群密钥、管理员身份
    ...[...existing].filter((k) => k.startsWith(epochKeyPrefix(groupId))).sort(),
    storageKeyForAdminKey(groupId),
    // 群专属身份的 deviceId；签名密钥在 Keystore 里，由调用方用 forgetGroupIdentity 删除
    storageKeyForGroupIdentity(groupId),
    // 2. 内容
    storageKeyForGroupMessages(groupId),
    storageKeyForDevices(groupId),
  ];

  const deletedKeys: string[] = [];
  for (const key of targets) {
    if (!existing.has(key)) continue;
    await store.delete(key);
    deletedKeys.push(key);
  }

  // 3. 最后从群列表里拿掉（群列表里有原始密钥材料）
  const groups = await loadJoinedGroups(store);
  if (groups.some((g) => g.groupId === groupId)) {
    await saveJoinedGroups(store, removeGroup(groups, groupId));
  }

  const remainingKeys = (await store.listKeys()).filter((k) => belongsToGroup(k, groupId)).sort();
  return { groupId, deletedKeys, remainingKeys };
}
