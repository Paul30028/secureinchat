import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 中继地址的校验与持久化。
 *
 * 为什么要应用内可配：构建时注入的 VITE_RELAY_URL 意味着换一次服务器就要重新
 * 打一次 APK，团队也没法自己填地址。地址本身不是秘密（谁连这个中继都看得到），
 * 所以直接存 IndexedDB，不走加密存储。
 */

const STORAGE_KEY = "settings:relay-url";

export type RelayUrlValidation = { ok: true } | { ok: false; reason: string };

/**
 * 校验中继地址。`isSecurePage` 传当前页面是否为 HTTPS——HTTPS 页面下浏览器
 * 会拦截 ws:// 的混合内容连接，与其让用户遇到"莫名其妙连不上"，不如在这里
 * 直接拒绝并说清原因。
 */
export function validateRelayUrl(raw: string, isSecurePage: boolean): RelayUrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "地址不能为空" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "地址格式不正确，例如：wss://ws.example.com" };
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return { ok: false, reason: "地址必须以 ws:// 或 wss:// 开头" };
  }

  if (isSecurePage && parsed.protocol === "ws:") {
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLocalhost) {
      return {
        ok: false,
        reason: "当前页面是 HTTPS，浏览器会拦截 ws:// 连接，请改用 wss://",
      };
    }
  }

  return { ok: true };
}

const backend = new IndexedDbStorageBackend();

/** 读取保存过的地址；没保存过返回 undefined，调用方用构建时默认值兜底 */
export async function loadSavedRelayUrl(): Promise<string | undefined> {
  try {
    const bytes = await backend.get(STORAGE_KEY);
    return bytes ? new TextDecoder().decode(bytes) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveRelayUrl(url: string): Promise<void> {
  await backend.set(STORAGE_KEY, new TextEncoder().encode(url.trim()));
}

export async function clearSavedRelayUrl(): Promise<void> {
  await backend.delete(STORAGE_KEY);
}
