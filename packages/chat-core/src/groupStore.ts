import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";

/**
 * 已加入的群列表。
 *
 * 走加密存储：里面存着每个群的原始密钥材料，拿到它就能解密该群的全部历史消息，
 * 敏感程度和消息本身一样。
 */

const GROUPS_KEY = "groups:joined";

export interface JoinedGroup {
  groupId: string;
  groupName: string;
  /** 邀请串里的原始密钥材料，重新连接时用它派生群密钥 */
  keyMaterialB64Url: string;
  epoch: number;
  /**
   * 管理员公钥，用来验证这个群的公告签名。
   *
   * 必须持久化：它来自邀请串，但重启后是从本地恢复群列表的，不再经过邀请串。
   * 不存的话重连之后这个字段是 undefined，所有公告都验不过、被静默丢弃——
   * 表现成"别人发的公告我收不到"。
   */
  adminPublicKeyRawB64Url?: string | undefined;
  joinedAtMs: number;
  /** 最后一次查看这个群的时间，用来算未读数 */
  lastReadAtMs: number;
}

export async function loadJoinedGroups(store: EncryptedKeyValueStore): Promise<JoinedGroup[]> {
  try {
    const bytes = await store.get(GROUPS_KEY);
    if (!bytes) return [];
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? (parsed as JoinedGroup[]) : [];
  } catch {
    // 解密失败或数据损坏——当作没加过群。用户可以用邀请码重新加入，
    // 比让应用起不来强。
    return [];
  }
}

export async function saveJoinedGroups(store: EncryptedKeyValueStore, groups: JoinedGroup[]): Promise<void> {
  await store.set(GROUPS_KEY, new TextEncoder().encode(JSON.stringify(groups)));
}

/**
 * 加入或更新一个群。同一个 groupId 重复加入不会产生两条记录——
 * 会更新群名和密钥材料（对方可能重新生成了邀请码），但保留原来的加入时间。
 */
export function upsertGroup(groups: JoinedGroup[], group: JoinedGroup): JoinedGroup[] {
  const existing = groups.find((g) => g.groupId === group.groupId);
  if (!existing) return [...groups, group];
  return groups.map((g) =>
    g.groupId === group.groupId
      ? { ...group, joinedAtMs: existing.joinedAtMs, lastReadAtMs: existing.lastReadAtMs }
      : g
  );
}

export function removeGroup(groups: JoinedGroup[], groupId: string): JoinedGroup[] {
  return groups.filter((g) => g.groupId !== groupId);
}

/** 改群名。只改本机显示的名字——中继不知道群叫什么，别人那边不会跟着变。 */
export function renameGroup(groups: JoinedGroup[], groupId: string, groupName: string): JoinedGroup[] {
  return groups.map((g) => (g.groupId === groupId ? { ...g, groupName } : g));
}

export function markGroupRead(groups: JoinedGroup[], groupId: string, atMs = Date.now()): JoinedGroup[] {
  return groups.map((g) => (g.groupId === groupId ? { ...g, lastReadAtMs: atMs } : g));
}

/** 未读数 = 这个群里晚于 lastReadAtMs 且不是自己发的消息条数 */
export function unreadCount(
  messages: { sentAtMs: number; isOwn: boolean }[],
  lastReadAtMs: number
): number {
  return messages.filter((m) => !m.isOwn && m.sentAtMs > lastReadAtMs).length;
}
