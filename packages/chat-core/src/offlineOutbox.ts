/**
 * 离线消息队列（第九节"离线消息队列""失败重试"要求）。
 *
 * 发送函数由调用方注入（真正的 WebSocket 发送逻辑在 protocol/网络层），
 * 这个类只负责"发送失败了怎么办"的状态机和退避策略，方便脱离真实网络单测。
 */
export type OutboxStatus = "pending" | "sending" | "sent" | "failed";

export interface OutboxItem<T> {
  id: string;
  payload: T;
  attempts: number;
  status: OutboxStatus;
  lastError?: string;
}

export interface FlushResult {
  sent: string[];
  failed: string[];
  stillPending: string[];
}

/** 指数退避，带上限，避免长期离线后重连瞬间退避时间过长 */
export function computeBackoffMs(attemptNumber: number, baseMs = 1000, capMs = 30_000): number {
  if (attemptNumber < 1) return 0;
  return Math.min(baseMs * 2 ** (attemptNumber - 1), capMs);
}

export class OfflineOutbox<T> {
  private items = new Map<string, OutboxItem<T>>();

  constructor(private readonly maxAttempts = 5) {}

  enqueue(id: string, payload: T): void {
    if (this.items.has(id)) return; // 已在队列里，避免重复入队
    this.items.set(id, { id, payload, attempts: 0, status: "pending" });
  }

  listByStatus(status: OutboxStatus): OutboxItem<T>[] {
    return [...this.items.values()].filter((i) => i.status === status);
  }

  get(id: string): OutboxItem<T> | undefined {
    return this.items.get(id);
  }

  /** 重连后调用：按入队顺序尝试发送所有 pending 项 */
  async flush(sendFn: (payload: T) => Promise<void>): Promise<FlushResult> {
    const result: FlushResult = { sent: [], failed: [], stillPending: [] };
    for (const item of this.items.values()) {
      if (item.status !== "pending") continue;
      item.status = "sending";
      try {
        await sendFn(item.payload);
        item.status = "sent";
        result.sent.push(item.id);
      } catch (err) {
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        if (item.attempts >= this.maxAttempts) {
          item.status = "failed";
          result.failed.push(item.id);
        } else {
          item.status = "pending";
          result.stillPending.push(item.id);
        }
      }
    }
    return result;
  }

  /** 手动重试一条已标记失败的消息（对应"文件上传失败及重试状态"里的重试按钮） */
  retry(id: string): void {
    const item = this.items.get(id);
    if (!item) throw new Error(`Outbox 中不存在 id=${id} 的条目`);
    if (item.status !== "failed") return;
    item.status = "pending";
    item.attempts = 0;
  }
}
