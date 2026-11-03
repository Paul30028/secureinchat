/**
 * 设备主密钥的持久化——secure-storage 的 `EncryptedKeyValueStore` 靠这把密钥
 * 加密落盘的群密钥。如果这把主密钥每次页面加载都重新生成，落盘的群密钥密文
 * 下次就解不开了，等于"存了但没用"。用和 `BrowserKeystore` 一样的思路：
 * 不可导出（extractable: false），密钥对象直接存 IndexedDB。
 */
const DB_NAME = "secureinchat-master-key";
const DB_VERSION = 1;
const STORE_NAME = "keys";

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

function getFromDb(db: IDBDatabase, alias: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(alias);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error ?? new Error(`读取 alias=${alias} 失败`));
  });
}

function putInDb(db: IDBDatabase, alias: string, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    try {
      // 同上：CryptoKey 的结构化克隆在老 WebView 上可能同步抛错
      tx.objectStore(STORE_NAME).put(key, alias);
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

/** 已存在就复用（不覆盖——覆盖等于让所有已经用旧主密钥加密过的数据永久解不开），
 *  不存在就生成一把不可导出的新密钥并存起来。 */
export async function getOrCreatePersistentAeadKey(alias: string): Promise<CryptoKey> {
  const db = await openDb();
  const existing = await getFromDb(db, alias);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await putInDb(db, alias, key);
  return key;
}

/** C10-A：只读不建。迁移期间用来取旧主密钥；没有就返回 undefined。 */
export async function getPersistentAeadKeyIfExists(alias: string): Promise<CryptoKey | undefined> {
  const db = await openDb();
  const v = await getFromDb(db, alias);
  // 不用 instanceof CryptoKey：handbook 4.5，部分运行时没有这个全局，直接访问会抛 ReferenceError
  if (v && typeof v === "object" && !ArrayBuffer.isView(v) && "algorithm" in v) return v;
  return undefined;
}

/**
 * C10-A：同一个库里存字节（被硬件密钥包裹后的主密钥）。字节数组的结构化克隆
 * 老 WebView 也支持，这正是新方案避开 CryptoKey 落盘问题的方式。
 */
export async function getPersistentBytes(alias: string): Promise<Uint8Array | undefined> {
  const db = await openDb();
  const v: unknown = await getFromDb(db, alias);
  if (v === undefined) return undefined;
  // ArrayBuffer.isView 而不是 instanceof：结构化克隆回来的对象可能来自另一个 realm
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  // 有记录但认不出来：报错，绝不当成"没有"——否则上层会生成新主密钥覆盖它，旧数据就永远解不开了
  throw new Error(`alias=${alias} 的记录格式无法识别`);
}

export async function putPersistentBytes(alias: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(bytes, alias);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`写入 alias=${alias} 失败`));
  });
}

export async function deletePersistentEntry(alias: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(alias);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`删除 alias=${alias} 失败`));
  });
}
