/**
 * 重放检测 + 消息顺序校正（第九节 + 第十一节要求）。
 *
 * 两件事分开处理，不要混在一起：
 * 1. 重放检测是安全边界——同一个 (senderId, epoch, seq) 出现第二次，一律拒绝，
 *    不管是恶意重放还是网络层的重复投递，处理方式一样（丢弃）。
 * 2. 顺序校正是体验问题——网络乱序导致 seq=5 先于 seq=4 到达是正常情况，
 *    不能当成攻击拒绝，而是缓冲起来等 gap 补齐再按顺序交给 UI。
 */

export type SequenceCheckResult = "accepted" | "replay";

interface SenderEpochState {
  seenSeqs: Set<number>;
  highestSeq: number;
}

export class ReplayGuard {
  private state = new Map<string, SenderEpochState>();

  private keyFor(senderId: string, epoch: number): string {
    return `${senderId}#${epoch}`;
  }

  check(senderId: string, epoch: number, seq: number): SequenceCheckResult {
    const key = this.keyFor(senderId, epoch);
    let s = this.state.get(key);
    if (!s) {
      s = { seenSeqs: new Set(), highestSeq: -1 };
      this.state.set(key, s);
    }
    if (s.seenSeqs.has(seq)) {
      return "replay";
    }
    s.seenSeqs.add(seq);
    if (seq > s.highestSeq) s.highestSeq = seq;
    return "accepted";
  }

  /** 成员被移除触发 epoch 轮换后，旧 epoch 的重放状态不再需要，避免内存无限增长 */
  forgetEpoch(senderId: string, epoch: number): void {
    this.state.delete(this.keyFor(senderId, epoch));
  }
}

export interface OrderedEnvelope<T> {
  senderId: string;
  epoch: number;
  seq: number;
  payload: T;
}

/**
 * 按 (senderId, epoch) 维度做顺序校正：接受乱序到达，但只把"连续无 gap"的
 * 前缀交给 UI；后面到的、前面还有空洞的消息先缓冲。
 */
export class MessageOrderer<T> {
  private buffered = new Map<string, Map<number, OrderedEnvelope<T>>>();
  private nextExpected = new Map<string, number>();

  private keyFor(senderId: string, epoch: number): string {
    return `${senderId}#${epoch}`;
  }

  /** 提交一条已通过重放检测的消息；返回本次调用后"可以按顺序交付"的消息列表 */
  submit(envelope: OrderedEnvelope<T>): OrderedEnvelope<T>[] {
    const key = this.keyFor(envelope.senderId, envelope.epoch);
    if (!this.buffered.has(key)) this.buffered.set(key, new Map());
    if (!this.nextExpected.has(key)) this.nextExpected.set(key, 0);

    this.buffered.get(key)!.set(envelope.seq, envelope);

    const deliverable: OrderedEnvelope<T>[] = [];
    let expected = this.nextExpected.get(key)!;
    const bucket = this.buffered.get(key)!;
    while (bucket.has(expected)) {
      deliverable.push(bucket.get(expected)!);
      bucket.delete(expected);
      expected += 1;
    }
    this.nextExpected.set(key, expected);
    return deliverable;
  }

  /** 是否存在尚未补齐的空洞（供 UI 显示"正在同步消息"之类的状态） */
  hasPendingGap(senderId: string, epoch: number): boolean {
    const key = this.keyFor(senderId, epoch);
    return (this.buffered.get(key)?.size ?? 0) > 0;
  }
}
