import type { StorageBackend } from "./storageBackend";

/**
 * 真正跨页面刷新持久化的存储后端——用 IndexedDB，不是 localStorage
 * （localStorage 只能存字符串、容量小、而且架构上明确禁止业务代码碰它，
 * 见 ARCHITECTURE.md）。这是 Web 端能做到的最接近"安全存储"的实现：数据
 * 持久化，但注意——IndexedDB 本身不加密，真正的机密性来自上层
 * `EncryptedKeyValueStore` 已经把值加密过了，这里存的是密文字节，不是明文。
 */
const DB_NAME = "secureinchat-storage";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开 IndexedDB 失败"));
  });
}

export class IndexedDbStorageBackend implements StorageBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
      req.onerror = () => reject(req.error ?? new Error(`读取 key=${key} 失败`));
    });
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`写入 key=${key} 失败`));
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`删除 key=${key} 失败`));
    });
  }

  async listKeys(prefix = ""): Promise<string[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]).filter((k) => k.startsWith(prefix));
        resolve(keys);
      };
      req.onerror = () => reject(req.error ?? new Error("列出 keys 失败"));
    });
  }
}
