import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 管理员私钥的本地保管。
 *
 * 只有建群的那台设备持有私钥。它是不可导出的 CryptoKey，直接存进 IndexedDB
 * （现代浏览器允许结构化克隆不可导出的密钥，读出来仍然不可导出），所以即使
 * 这个应用自己的代码也拿不到原始私钥字节。
 *
 * 换设备就没有这把钥匙——也就无法再发公告。这是当前设计的真实限制：
 * 管理员权限绑定在建群的那台设备上，没有转移机制。
 */

const DB_NAME = "secureinchat-admin-keys";
const DB_VERSION = 1;
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("打开 IndexedDB 失败"));
  });
}

export async function saveAdminKey(groupId: string, privateKey: CryptoKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(privateKey, groupId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("保存管理员密钥失败"));
  });
}

export async function loadAdminKey(groupId: string): Promise<CryptoKey | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(groupId);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error ?? new Error("读取管理员密钥失败"));
    });
  } catch {
    return undefined;
  }
}

/** 这台设备是不是这个群的管理员——有私钥才是，和界面上有没有解锁无关 */
export async function isGroupAdmin(groupId: string): Promise<boolean> {
  return (await loadAdminKey(groupId)) !== undefined;
}

/** 使用的是与 secure-storage 相同的后端约定，便于将来统一迁移 */
export const adminKeyBackendNote = IndexedDbStorageBackend.name;
