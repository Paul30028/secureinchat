/**
 * 备份导出和恢复预览（从 App.tsx 拆出，K6）。确认恢复要改 App 的状态，留在 App 里。
 */
import {
  buildBackupPayload,
  decryptBackup,
  encryptBackup,
  loadJoinedGroups,
  loadMessages,
  mergeRestore,
  type BackupPayload,
  type StoredMessage,
} from "@secureinchat/chat-core";
import { getDeviceStore } from "../deviceIdentity";

/**
 * 导出备份。
 * 从存储读，而不是从内存的 sessions 读——这样即使某个群当前没连上，
 * 也能把它的历史备份出去。C8 已把媒体 base64 落盘，所以这里拿到的
 * StoredMessage 自带媒体内容。
 */
export async function exportBackup(nickname: string | undefined, password: string): Promise<string> {
  const store = await getDeviceStore();
  const groups = await loadJoinedGroups(store);
  const messagesByGroup: Record<string, StoredMessage[]> = {};
  for (const g of groups) {
    messagesByGroup[g.groupId] = await loadMessages(store, g.groupId);
  }
  const payload = buildBackupPayload(groups, messagesByGroup, nickname, Date.now());
  return encryptBackup(payload, password);
}

export interface RestorePreview {
  groups: number;
  messages: number;
  skipped: number;
}

/** 解密备份并算出预览（不落盘）。预览按真正会发生的合并来算：本机已有的群不动，只报告新增的。 */
export async function previewRestore(
  text: string,
  password: string
): Promise<{ payload: BackupPayload; preview: RestorePreview }> {
  const payload = await decryptBackup(text, password);
  const store = await getDeviceStore();
  const existingGroups = await loadJoinedGroups(store);
  const merged = mergeRestore(existingGroups, {}, payload);
  return {
    payload,
    preview: { groups: merged.addedGroupIds.length, messages: merged.addedMessages, skipped: merged.skippedGroupIds.length },
  };
}
