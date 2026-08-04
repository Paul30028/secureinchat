import type { RelayClient, ConnectionStatus } from "@secureinchat/chat-core";
import type { DisplayMessage, Announcement } from "./screens/ChatScreen";

/**
 * 一个群的会话状态。
 *
 * 多群支持的核心：中继是"一条连接对应一个群"的，所以加入 N 个群就有 N 条
 * 连接、N 份状态。把这些打包成一个对象，App 只需要持有
 * `Record<groupId, GroupSession>`，而不是把每个字段都摊平成 N 份。
 *
 * 所有群的连接都保持在线——否则在 A 群时 B 群来了消息你根本不会知道。
 */
export interface GroupSession {
  groupId: string;
  groupName: string;
  client: RelayClient;
  messages: DisplayMessage[];
  connectionStatus: ConnectionStatus;
  pendingCount: number;
  /** 同群在线的其他设备（中继推送的） */
  onlinePeers: string[];
  announcement?: Announcement | undefined;
  sendError?: string | undefined;
  incomingProgress?: { fileId: string; fileName: string; receivedChunks: number; totalChunks: number }[];
  /** 上次查看这个群的时间，用来算未读 */
  lastReadAtMs: number;
}

export type GroupSessions = Record<string, GroupSession>;

/** 未读数：晚于上次查看、且不是自己发的 */
export function unreadFor(session: GroupSession): number {
  return session.messages.filter((m) => !m.isOwn && m.sentAtMs > session.lastReadAtMs).length;
}

/** 列表预览文案——媒体消息显示类型和文件名，而不是空白 */
export function previewFor(session: GroupSession): { preview: string; sentAtMs: number } | undefined {
  const last = session.messages[session.messages.length - 1];
  if (!last) return undefined;
  if (last.text) return { preview: last.text, sentAtMs: last.sentAtMs };
  if (last.media) {
    const label = last.media.mediaKind === "image" ? "图片" : last.media.mediaKind === "voice" ? "语音" : "文件";
    return { preview: `[${label}] ${last.media.fileName}`, sentAtMs: last.sentAtMs };
  }
  return { preview: "", sentAtMs: last.sentAtMs };
}

/** 按最后一条消息时间倒序——最近有动静的群排前面 */
export function sortSessions(sessions: GroupSessions): GroupSession[] {
  return Object.values(sessions).sort((a, b) => {
    const aTime = a.messages[a.messages.length - 1]?.sentAtMs ?? 0;
    const bTime = b.messages[b.messages.length - 1]?.sentAtMs ?? 0;
    return bTime - aTime;
  });
}

export function patchSession(
  sessions: GroupSessions,
  groupId: string,
  patch: Partial<GroupSession>
): GroupSessions {
  const existing = sessions[groupId];
  if (!existing) return sessions;
  return { ...sessions, [groupId]: { ...existing, ...patch } };
}
