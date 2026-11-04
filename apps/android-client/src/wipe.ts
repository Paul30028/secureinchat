import { disableLock } from "./appLock";

/**
 * 「全部清除」：删掉本机所有 SecureInChat 数据库。
 *
 * 关键是 `secureinchat-master-key`：设备主密钥在里面。主密钥没了，
 * 就算数据库文件的空闲页里还残留密文，也解不开（加密粉碎）。
 *
 * 用在两处：应用锁输错次数用尽；用户在「设备安全」里主动选择
 * 「这台手机曾离开过我」（包 1 / P1c）。
 */
export const LOCAL_DATABASES = [
  "secureinchat-master-key", // 先删主密钥：就算后面中断，剩下的也解不开
  "secureinchat-storage",
  "secureinchat-keystore",
  "secureinchat-admin-keys", // 旧版本留下的，新版本已不再写
] as const;

/** 删除一个数据库。被别的连接挡住时等待对方关闭，最多 timeoutMs；返回是否确认删掉。 */
export function deleteDatabase(name: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => done(true);
      req.onerror = () => done(false);
      // onblocked 不是失败：其他连接收到 versionchange 后会关闭，之后 onsuccess 仍会触发
    } catch {
      done(false);
    }
  });
}

export interface WipeResult {
  /** 确认删掉的数据库 */
  deleted: string[];
  /** 没能确认删掉的（超时或出错）——界面要如实告诉用户 */
  failed: string[];
}

export async function wipeAllLocalData(): Promise<WipeResult> {
  try {
    await disableLock();
  } catch {
    // 应用锁设置删不掉不影响清除数据本身
  }
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const name of LOCAL_DATABASES) {
    (await deleteDatabase(name)) ? deleted.push(name) : failed.push(name);
  }
  return { deleted, failed };
}
