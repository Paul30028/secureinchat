import {
  bytesToBase64Url,
  MAX_STORED_MESSAGES_PER_GROUP,
  shouldPersistMediaBytes,
  type StoredMessage,
} from "@secureinchat/chat-core";
import type { DisplayMessage } from "./screens/ChatScreen";
import { toStored } from "./messageMapping";

/**
 * 媒体内容的落盘缓存（C8）。
 *
 * 问题：消息历史每次都整体落盘，而界面里的消息只有 objectUrl、没有原始字节，
 * 所以只有「刚收到/刚发出」的那一条能把媒体内容写进去；下一次任何保存
 * （再来一条消息、删除、到期）都会把之前存过的图片/语音内容写成 undefined。
 *
 * 方案：每个群在内存里记住「已经落盘过的媒体 base64」（id → base64url），
 * 每次组装落盘列表时按 id 补回去。
 *
 * 取舍（相对于「保存前先从存储读出旧列表再合并」）：
 * - 读改写每次都要解密、解析整份历史（最多 300 条 × 512 KB），收一条消息就做一遍太慢；
 *   而且两次保存并发时，后一次读到的可能是前一次写完之前的旧数据，照样会丢。
 * - 缓存不用读存储，也就没有这个竞态；代价是内存：最坏每群约
 *   300 × 512 KB × 4/3 ≈ 200 MB 的字符串。实际受 MAX_PERSISTED_MEDIA_BYTES 和条数上限约束，
 *   而且界面里这些媒体本来就以 Blob 形式在内存里，量级相同。
 * - 缓存只保留「当前列表里还在、且落盘后还会留下」的 id：删除、到期、被条数上限挤掉的
 *   消息，内容同时从缓存和存储里消失（阅后即焚依赖这一点）。
 *
 * 没有改加密存储和 messageStore 的接口。
 */
export class PersistedMediaCache {
  private readonly byGroup = new Map<string, Map<string, string>>();

  /** 从加载出的历史里记住已落盘的媒体内容（重启后第一次保存不能把它们丢掉）。 */
  seed(groupId: string, stored: readonly StoredMessage[]): void {
    const map = new Map<string, string>();
    for (const m of stored) {
      if (m.media?.dataB64Url) map.set(m.id, m.media.dataB64Url);
    }
    this.byGroup.set(groupId, map);
  }

  /** 离开群时整组丢掉。 */
  forget(groupId: string): void {
    this.byGroup.delete(groupId);
  }

  /** 测试用：某个群当前缓存了多少条媒体内容。 */
  sizeOf(groupId: string): number {
    return this.byGroup.get(groupId)?.size ?? 0;
  }

  /**
   * 把界面里的消息列表组装成要落盘的列表。
   *
   * @param newBytes 本次新到的媒体原始字节（id → bytes），通常只有一条。
   * @returns 已按条数上限截断的列表（和 saveMessages 内部的截断结果一致）。
   */
  buildStored(
    groupId: string,
    messages: readonly DisplayMessage[],
    newBytes?: ReadonlyMap<string, Uint8Array>
  ): StoredMessage[] {
    const old = this.byGroup.get(groupId) ?? new Map<string, string>();
    // 先截断再组装：被条数上限挤掉的消息不必再编码，它们的内容也要从缓存里放掉
    const limit = MAX_STORED_MESSAGES_PER_GROUP;
    const kept = messages.length <= limit ? messages : messages.slice(messages.length - limit);
    const next = new Map<string, string>();
    const out: StoredMessage[] = [];
    for (const m of kept) {
      const stored = toStored(m);
      if (stored.media) {
        const bytes = newBytes?.get(m.id);
        let b64: string | undefined;
        if (bytes && shouldPersistMediaBytes(m.media?.sizeBytes ?? bytes.length)) {
          b64 = bytesToBase64Url(bytes);
        } else {
          b64 = old.get(m.id);
        }
        if (b64 !== undefined) {
          next.set(m.id, b64);
          out.push({ ...stored, media: { ...stored.media, dataB64Url: b64 } });
          continue;
        }
      }
      out.push(stored);
    }
    this.byGroup.set(groupId, next);
    return out;
  }
}

/**
 * 每个群的写入排队：保证落盘按调用顺序完成。
 *
 * saveMessages 是异步的（加密 + IndexedDB），连续两次不 await 的保存可能乱序完成，
 * 旧列表覆盖新列表——刚删掉的媒体就会「复活」在存储里。排队后最后一次调用一定最后写。
 */
export class SerialSaver {
  private readonly tails = new Map<string, Promise<void>>();

  enqueue(groupId: string, write: () => Promise<void>): Promise<void> {
    const prev = this.tails.get(groupId) ?? Promise.resolve();
    // 前一次失败不影响后一次：后一次写的是完整列表，会覆盖
    const run = prev.then(write, write);
    const tail = run.catch(() => undefined);
    this.tails.set(groupId, tail);
    void tail.then(() => {
      if (this.tails.get(groupId) === tail) this.tails.delete(groupId);
    });
    return run;
  }
}
