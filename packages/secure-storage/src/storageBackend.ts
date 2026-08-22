/**
 * StorageBackend 是"哪里落盘"的最底层接口——只认 key/字节，不知道加密。
 * 真正的 Android 实现会包一层 SQLite（旧仓库用的也是 SQLite），这里只定义端口
 * 和一个仅供测试用的内存实现。
 *
 * 架构红线：整个仓库里，只有这个文件（以及它在 Android 端的真实实现）允许
 * 直接接触底层持久化 API。任何其他包如果想存东西，必须经过
 * `EncryptedKeyValueStore`，不能自己 new 一个 backend。
 */
export interface StorageBackend {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix?: string): Promise<string[]>;
}

/** ⚠️ 仅供单元测试。数据存在进程内存里，进程一退出就没了，也没有任何加密。 */
export class TestOnlyInMemoryStorageBackend implements StorageBackend {
  private store = new Map<string, Uint8Array>();

  async get(key: string): Promise<Uint8Array | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async listKeys(prefix = ""): Promise<string[]> {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}
