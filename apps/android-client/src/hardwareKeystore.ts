import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  HardwareKeyError,
  type HardwareKeyWrapper,
  type HardwareLevel,
} from "@secureinchat/secure-storage";
import { t } from "./i18n";

/**
 * C10-A：原生 HardwareKeystore 插件（KeystorePlugin.java）的 TS 封装。
 *
 * 只在 Android 原生平台可用；Web 端返回 null，上层保持原来的做法并在界面上写明保护级别较低。
 * 主密钥原始字节经 base64 过桥后立刻清零；不打印、不记录。
 */

export interface HardwareKeystorePlugin {
  ensureKey(): Promise<{ level: string }>;
  wrap(o: { data: string; aad: string }): Promise<{ data: string }>;
  unwrap(o: { data: string; aad: string }): Promise<{ data: string }>;
  deleteKey(): Promise<void>;
}

const NativeHardwareKeystore = registerPlugin<HardwareKeystorePlugin>("HardwareKeystore");

const LEVELS: readonly HardwareLevel[] = ["strongbox", "tee", "software"];

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** 插件 reject 的 code → 上层能处理的失败原因 */
function mapError(err: unknown): HardwareKeyError {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  const message = err instanceof Error ? err.message : t("keystore.genericError");
  if (code === "KEY_MISSING") return new HardwareKeyError("missing", message);
  if (code === "KEY_INVALIDATED") return new HardwareKeyError("invalidated", message);
  return new HardwareKeyError("failed", message);
}

export function createHardwareKeyWrapper(plugin: HardwareKeystorePlugin): HardwareKeyWrapper {
  return {
    async ensureKey() {
      const { level } = await plugin.ensureKey();
      // 不认识的级别按最低的算，不往高里报
      return (LEVELS as readonly string[]).includes(level) ? (level as HardwareLevel) : "software";
    },
    async wrap(raw, aad) {
      const data = toB64(raw);
      try {
        return fromB64((await plugin.wrap({ data, aad: toB64(aad) })).data);
      } catch (err) {
        throw mapError(err);
      }
    },
    async unwrap(wrapped, aad) {
      let res: { data: string };
      try {
        res = await plugin.unwrap({ data: toB64(wrapped), aad: toB64(aad) });
      } catch (err) {
        throw mapError(err);
      }
      return fromB64(res.data);
    },
    async deleteKey() {
      await plugin.deleteKey();
    },
  };
}

/** Android 原生平台的硬件密钥库；其他平台返回 null。 */
export function nativeHardwareKeyWrapper(): HardwareKeyWrapper | null {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return null;
  return createHardwareKeyWrapper(NativeHardwareKeystore);
}
