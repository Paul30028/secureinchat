/**
 * 启动自检。
 *
 * 这个应用把加密密钥以 CryptoKey 对象的形式存进 IndexedDB，依赖结构化克隆
 * 支持 CryptoKey。老版本的 Android System WebView 不一定支持，而失败点在
 * 建群/加群的中途——表现成"建完群进不去""扫码没反应"这种和真实原因
 * 毫无关系的症状，排查起来极难。
 *
 * 所以在启动时先测一次：能力不足就直接说清楚，而不是让用户在半路撞墙。
 */

const PROBE_DB = "secureinchat-capability-probe";
const PROBE_STORE = "probe";

export type CapabilityResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string | undefined };

function deleteProbeDb(): void {
  try {
    indexedDB.deleteDatabase(PROBE_DB);
  } catch {
    // 清理失败无所谓，下次覆盖
  }
}

/** 能不能把 CryptoKey 存进 IndexedDB —— 这是整个应用的地基 */
export async function checkCryptoStorage(): Promise<CapabilityResult> {
  if (typeof indexedDB === "undefined") {
    return { ok: false, reason: "这台设备不支持本地存储（IndexedDB）" };
  }
  if (!globalThis.crypto?.subtle) {
    return {
      ok: false,
      reason: "无法使用加密功能",
      detail: "页面必须通过 HTTPS 打开（或 localhost），否则浏览器不提供加密接口。",
    };
  }

  try {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(PROBE_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(PROBE_STORE)) d.createObjectStore(PROBE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("打开数据库失败"));
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROBE_STORE, "readwrite");
      try {
        tx.objectStore(PROBE_STORE).put(key, "probe");
      } catch (err) {
        // 结构化克隆不支持 CryptoKey 时，这里是同步抛出的
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("写入失败"));
    });

    db.close();
    deleteProbeDb();
    return { ok: true };
  } catch (err) {
    deleteProbeDb();
    return {
      ok: false,
      reason: "这台设备的浏览器内核太旧，无法保存加密密钥",
      detail:
        "请到应用商店更新「Android System WebView」和 Chrome 后重试。" +
        (err instanceof Error ? `（${err.message}）` : ""),
    };
  }
}
