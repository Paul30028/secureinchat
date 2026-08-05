/**
 * 消息搜索与引用摘要。
 *
 * 搜索完全在本地做——消息已经解密后存在本机（见 messageStore），中继上只有
 * 密文，服务端搜不了也不该能搜。
 */

export interface SearchableMessage {
  id: string;
  text?: string | undefined;
  media?: { fileName: string } | undefined;
  senderLabel?: string | undefined;
  sentAtMs: number;
}

export interface SearchHit<T extends SearchableMessage> {
  message: T;
  /** 命中的位置，供 UI 高亮 */
  matchStart: number;
  matchLength: number;
}

export const REPLY_EXCERPT_MAX = 60;

/**
 * 在消息里搜关键词。匹配正文和文件名，大小写不敏感。
 * 空关键词返回空结果——不是"返回全部"，那会让搜索框一打开就渲染几百条。
 */
export function searchMessages<T extends SearchableMessage>(messages: T[], query: string): SearchHit<T>[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit<T>[] = [];
  for (const message of messages) {
    const haystack = (message.text ?? message.media?.fileName ?? "").toLowerCase();
    const index = haystack.indexOf(q);
    if (index !== -1) {
      hits.push({ message, matchStart: index, matchLength: q.length });
    }
  }
  // 最新的排前面——找东西通常是找最近说过的
  return hits.sort((a, b) => b.message.sentAtMs - a.message.sentAtMs);
}

/** 引用时保留的摘要：过长就截断加省略号，媒体消息用文件名 */
export function buildReplyExcerpt(message: SearchableMessage): string {
  const raw = message.text ?? (message.media ? `[文件] ${message.media.fileName}` : "");
  if (raw.length <= REPLY_EXCERPT_MAX) return raw;
  return `${raw.slice(0, REPLY_EXCERPT_MAX)}…`;
}

/** 复制到剪贴板。失败（权限被拒/不支持）返回 false 而不是抛错——
 *  调用方据此决定是否提示用户，不该因为复制失败让界面崩掉。 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
