import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";

/**
 * 消息历史的本地持久化。
 *
 * 和昵称、服务器地址不同，聊天内容是敏感的——所以走 EncryptedKeyValueStore
 * （用设备主密钥加密后落盘），不能直接塞 IndexedDB 明文。
 *
 * 中继按设计不存任何消息，所以历史只能存在本地：换设备看不到旧消息，
 * 清除应用数据也会丢。这是盲中继架构的必然结果，不是没做完。
 */

/** 每个群最多保留多少条。超出后丢最旧的——避免长期使用后本地存储无限膨胀。 */
export const MAX_STORED_MESSAGES_PER_GROUP = 300;

/** 单条媒体消息超过这个大小就不持久化（只留一条占位记录）。
 *  几张大图就能把本地存储撑爆，而且加解密大 blob 也慢。 */
export const MAX_PERSISTED_MEDIA_BYTES = 512 * 1024;

export interface StoredMessage {
  id: string;
  isOwn: boolean;
  /** 发送者显示名（昵称，或设备 ID 短前缀） */
  senderLabel?: string | undefined;
  sentAtMs: number;
  text?: string | undefined;
  media?:
    | {
        mediaKind: "image" | "voice" | "file";
        fileName: string;
        mimeType: string;
        /** base64url；超过 MAX_PERSISTED_MEDIA_BYTES 时为 undefined（内容没留下） */
        dataB64Url?: string | undefined;
        sizeBytes: number;
      }
    | undefined;
}

export function storageKeyForGroupMessages(groupId: string): string {
  return `messages:${groupId}`;
}

/** 只保留最近 N 条 */
export function trimToLimit(messages: StoredMessage[], limit = MAX_STORED_MESSAGES_PER_GROUP): StoredMessage[] {
  return messages.length <= limit ? messages : messages.slice(messages.length - limit);
}

export async function loadMessages(store: EncryptedKeyValueStore, groupId: string): Promise<StoredMessage[]> {
  try {
    const bytes = await store.get(storageKeyForGroupMessages(groupId));
    if (!bytes) return [];
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return Array.isArray(parsed) ? (parsed as StoredMessage[]) : [];
  } catch {
    // 解密失败（换了设备主密钥）或内容损坏——当作没有历史，不要因此让应用起不来。
    // 用户会看到空的聊天记录，但功能是好的。
    return [];
  }
}

export async function saveMessages(
  store: EncryptedKeyValueStore,
  groupId: string,
  messages: StoredMessage[]
): Promise<void> {
  const trimmed = trimToLimit(messages);
  const bytes = new TextEncoder().encode(JSON.stringify(trimmed));
  await store.set(storageKeyForGroupMessages(groupId), bytes);
}

export async function clearMessages(store: EncryptedKeyValueStore, groupId: string): Promise<void> {
  await store.delete(storageKeyForGroupMessages(groupId));
}

/** 媒体内容是否值得持久化——太大就只留元信息 */
export function shouldPersistMediaBytes(sizeBytes: number): boolean {
  return sizeBytes <= MAX_PERSISTED_MEDIA_BYTES;
}
