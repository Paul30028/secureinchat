import type { KeystorePort } from "./keystorePort";

/**
 * Web 端的 KeystorePort 实现——不是 Android 硬件 Keystore，但比
 * `TestOnlyInMemoryKeystore` 真实：
 * - 私钥生成时标记 `extractable: false`，应用代码永远拿不到私钥原始字节
 *   （连这个类自己的代码都拿不到，`sign`/`verify` 只能让 Web Crypto 内部用它）
 * - 密钥对象（`CryptoKeyPair`）直接存进 IndexedDB——现代浏览器允许结构化克隆
 *   不可导出的 CryptoKey，读出来的还是同一个不可导出的 CryptoKey，不会绕过
 *   extractable 限制
 * - 跨页面刷新保留：同一个 alias 第二次 `generateDeviceKeyPair` 不会覆盖已有
 *   的密钥对，设备身份保持稳定（这是这次要解决的问题的核心）
 *
 * 真机 Android 版本仍然需要一个原生 Capacitor 插件去接 Android Keystore/
 * StrongBox——这个类只覆盖 Web 端。
 */
const DB_NAME = "secureinchat-keystore";
const DB_VERSION = 1;
const STORE_NAME = "keypairs";

interface StoredKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

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

export class BrowserKeystore implements KeystorePort {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  private async loadPair(alias: string): Promise<StoredKeyPair | undefined> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(alias);
      req.onsuccess = () => resolve(req.result as StoredKeyPair | undefined);
      req.onerror = () => reject(req.error ?? new Error(`读取 alias=${alias} 失败`));
    });
  }

  private async storePair(alias: string, pair: StoredKeyPair): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      try {
        // 存的是 CryptoKey 对象，依赖结构化克隆支持它。老版本 Android WebView
        // 不一定支持，而且失败是在 put() 同步抛出的——不放在 try 里就绕过了
        // 下面的 onerror，变成一个没人接的异常。
        tx.objectStore(STORE_NAME).put(pair, alias);
      } catch (err) {
        reject(
          new Error(
            `这台设备的浏览器内核无法保存加密密钥（${err instanceof Error ? err.message : "结构化克隆失败"}）。` +
              `请更新系统的 Android System WebView 后重试。`
          )
        );
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`写入 alias=${alias} 失败`));
    });
  }

  private async requirePair(alias: string): Promise<StoredKeyPair> {
    const pair = await this.loadPair(alias);
    if (!pair) throw new Error(`未找到别名为 ${alias} 的密钥对，先调用 generateDeviceKeyPair`);
    return pair;
  }

  async generateDeviceKeyPair(alias: string): Promise<string> {
    const existing = await this.loadPair(alias);
    if (existing) return alias; // 已存在就复用，不覆盖——设备身份要保持稳定

    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    await this.storePair(alias, { privateKey: pair.privateKey, publicKey: pair.publicKey });
    return alias;
  }

  async sign(alias: string, data: Uint8Array): Promise<Uint8Array> {
    const pair = await this.requirePair(alias);
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, data as BufferSource);
    return new Uint8Array(sig);
  }

  async verify(alias: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const pair = await this.requirePair(alias);
    return crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      signature as BufferSource,
      data as BufferSource
    );
  }

  async exportPublicKeyRaw(alias: string): Promise<Uint8Array> {
    const pair = await this.requirePair(alias);
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    return new Uint8Array(raw);
  }

  async hasHardwareBackedKeystore(): Promise<boolean> {
    // Web Crypto 在大多数浏览器里不是硬件隔离的（不像 Android StrongBox/TEE）——
    // 如实返回 false，不要让 UI 显示一个"硬件保护"的安心提示，那是假的。
    return false;
  }
}
