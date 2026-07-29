/**
 * 群 epoch 管理：成员移除必须触发 epoch 递增，被移除成员拿不到新 epoch 的密钥材料。
 *
 * 注意：这不是 MLS。这是"共享群密钥 + epoch 版本号"的过渡方案，前向保密仅限于
 * "移除后的新消息"，不覆盖"移除前已经拿到的历史密钥可否解密旧消息"这一类更强的
 * 保证（那需要真正的 MLS/树形密钥）。这一点必须在 UI 和文档中如实注明，
 * 不能包装成"前向保密已完整实现"。
 */

import { deriveGroupEpochKey } from "./keyDerivation";

export interface EpochRecord {
  epoch: number;
  key: CryptoKey;
  createdAtMs: number;
}

export interface GroupEpochManager {
  currentEpoch(): number;
  getKeyForEpoch(epoch: number): CryptoKey | undefined;
  /** 成员移除 / 主动轮换时调用，返回新 epoch 号 */
  rotate(): Promise<number>;
}

/**
 * 参考实现：内存中维护 epoch -> key 的映射。真正的持久化（谁在哪个 epoch 拿到了
 * 哪把密钥、被移除成员的 epoch 上限）由 secure-storage + 服务端成员表共同负责，
 * 这里只处理"给定原始群密钥材料，如何算出新 epoch 的密钥"。
 */
export class InMemoryGroupEpochManager implements GroupEpochManager {
  private epochs = new Map<number, EpochRecord>();
  private latestEpoch: number;

  private constructor(
    private readonly rawKeyMaterial: Uint8Array,
    private readonly groupId: string,
    initialEpoch: number,
    initialKey: CryptoKey
  ) {
    this.latestEpoch = initialEpoch;
    this.epochs.set(initialEpoch, { epoch: initialEpoch, key: initialKey, createdAtMs: Date.now() });
  }

  static async create(rawKeyMaterial: Uint8Array, groupId: string, initialEpoch = 0): Promise<InMemoryGroupEpochManager> {
    const key = await deriveGroupEpochKey({ rawKeyMaterial, groupId, epoch: initialEpoch });
    return new InMemoryGroupEpochManager(rawKeyMaterial, groupId, initialEpoch, key);
  }

  currentEpoch(): number {
    return this.latestEpoch;
  }

  getKeyForEpoch(epoch: number): CryptoKey | undefined {
    return this.epochs.get(epoch)?.key;
  }

  async rotate(): Promise<number> {
    const nextEpoch = this.latestEpoch + 1;
    const key = await deriveGroupEpochKey({ rawKeyMaterial: this.rawKeyMaterial, groupId: this.groupId, epoch: nextEpoch });
    this.epochs.set(nextEpoch, { epoch: nextEpoch, key, createdAtMs: Date.now() });
    this.latestEpoch = nextEpoch;
    return nextEpoch;
  }
}
