/**
 * 按 clientMessageId 去重（第九节要求）。同一条消息因为重连/重试可能被送达多次，
 * UI 层不应该重复渲染。
 *
 * 用一个有上限的"最近见过"集合而不是无限增长的 Set——长期在线的会话不能让这个
 * 结构无限吃内存。超过上限后按插入顺序淘汰最旧的（近似 LRU，不追求精确 LRU）。
 */
export class MessageDeduplicator {
  private seen = new Map<string, true>();

  constructor(private readonly maxTracked = 5000) {}

  /** 返回 true 表示"之前没见过，应该处理"；返回 false 表示"重复，丢弃" */
  shouldProcess(clientMessageId: string): boolean {
    if (this.seen.has(clientMessageId)) {
      return false;
    }
    this.seen.set(clientMessageId, true);
    if (this.seen.size > this.maxTracked) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }

  get trackedCount(): number {
    return this.seen.size;
  }
}
