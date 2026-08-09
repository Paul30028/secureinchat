import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 应用锁。
 *
 * 手机被别人拿到时，群里的内容不该直接可见——对一个私密小团体，这是最实际的
 * 一层保护。
 *
 * PIN 本身不存：存的是 PBKDF2 派生值和随机盐，校验时重新派生再比对。所以即使
 * 有人能读到本机的 IndexedDB，也拿不回 PIN。
 *
 * ⚠️ 边界要说清楚：应用锁保护的是"别人拿起你的手机随手打开"这个场景。它**不**
 * 加密聊天记录——消息用的是设备主密钥，和 PIN 无关。有能力从设备里提取数据的
 * 攻击者不会被这一层挡住。
 */

const LOCK_KEY = "applock:v1";
const ITERATIONS = 210_000;
export const PIN_MIN_LENGTH = 4;
export const MAX_ATTEMPTS = 10;

const backend = new IndexedDbStorageBackend();

interface StoredLock {
  saltB64: string;
  hashB64: string;
  failedAttempts: number;
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin) as BufferSource, "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toB64(new Uint8Array(bits));
}

async function read(): Promise<StoredLock | undefined> {
  try {
    const bytes = await backend.get(LOCK_KEY);
    return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as StoredLock) : undefined;
  } catch {
    return undefined;
  }
}

async function write(lock: StoredLock): Promise<void> {
  await backend.set(LOCK_KEY, new TextEncoder().encode(JSON.stringify(lock)));
}

export async function isLockEnabled(): Promise<boolean> {
  return (await read()) !== undefined;
}

export type PinValidation = { ok: true } | { ok: false; reason: string };

export function validatePin(pin: string): PinValidation {
  if (pin.length < PIN_MIN_LENGTH) return { ok: false, reason: `密码至少 ${PIN_MIN_LENGTH} 位` };
  if (!/^\d+$/.test(pin)) return { ok: false, reason: "密码只能是数字" };
  if (/^(\d)\1+$/.test(pin)) return { ok: false, reason: "不要使用重复的数字" };
  return { ok: true };
}

export async function enableLock(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await write({ saltB64: toB64(salt), hashB64: await derive(pin, salt), failedAttempts: 0 });
}

export async function disableLock(): Promise<void> {
  await backend.delete(LOCK_KEY);
}

export interface UnlockResult {
  ok: boolean;
  /** 还剩几次机会；用完会清空本机数据 */
  attemptsLeft: number;
}

/**
 * 校验 PIN。连续失败 MAX_ATTEMPTS 次返回 attemptsLeft = 0，由调用方决定
 * 是否清空数据——这个模块只负责判断，不替调用方做删除的决定。
 */
export async function tryUnlock(pin: string): Promise<UnlockResult> {
  const lock = await read();
  if (!lock) return { ok: true, attemptsLeft: MAX_ATTEMPTS };

  const candidate = await derive(pin, fromB64(lock.saltB64));
  if (candidate === lock.hashB64) {
    await write({ ...lock, failedAttempts: 0 });
    return { ok: true, attemptsLeft: MAX_ATTEMPTS };
  }

  const failedAttempts = lock.failedAttempts + 1;
  await write({ ...lock, failedAttempts });
  return { ok: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - failedAttempts) };
}
