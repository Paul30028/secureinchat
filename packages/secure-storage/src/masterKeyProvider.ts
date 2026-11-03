import { importAeadKeyRawNonExtractable, randomAeadKeyBytes } from "@secureinchat/crypto-core";
import type { StorageBackend } from "./storageBackend";

/**
 * C10-A：本机主密钥从哪来。
 *
 * Android 原生：主密钥（32 字节随机数）被 Android Keystore 里的硬件密钥（StrongBox 优先，
 * 否则 TEE）用 AES-GCM 包裹，落盘的只有包裹后的字节。启动时请系统解包，导入成
 * **不可导出**的 CryptoKey 用于日常加解密，原始字节随即清零。
 * 拷走应用数据目录的人拿不到硬件密钥，解不开主密钥。
 * 不防：已解锁设备上以本应用身份运行的代码（例如 root 后）直接请 Keystore 解包——
 * M1 没有绑定用户认证（Paul 的决定，见 drop/deepseek/c10/design.txt 方案 A）。
 *
 * Web 端和硬件密钥不可用的设备：保持原来的做法（不可导出 CryptoKey 直接存 IndexedDB），
 * 保护级别较低，界面上如实写出。
 *
 * 从旧做法升级：旧主密钥保留为 legacy，EncryptedKeyValueStore 读时两把都试、写用新的，
 * 后台迁移完成后才删除旧密钥（finishLegacyMigration）。
 */

export type HardwareLevel = "strongbox" | "tee" | "software";

/** 界面显示的保护级别。webview = 没有硬件包裹（Web 端，或这台设备的 Keystore 不可用）。 */
export type MasterKeyProtection = HardwareLevel | "webview";

export type HardwareKeyErrorKind = "missing" | "invalidated" | "failed";

/** 原生层解包失败的原因。missing：硬件密钥不在了（卸载重装、清除数据后系统备份又恢复了文件等）。 */
export class HardwareKeyError extends Error {
  constructor(
    readonly kind: HardwareKeyErrorKind,
    message: string
  ) {
    super(message);
    this.name = "HardwareKeyError";
  }
}

/** 本机数据存在、但主密钥解不开。界面据此提示「从备份恢复」，绝不悄悄换一把新密钥。 */
export class MasterKeyUnavailableError extends Error {
  constructor(
    readonly kind: HardwareKeyErrorKind,
    message: string
  ) {
    super(message);
    this.name = "MasterKeyUnavailableError";
  }
}

/** 原生 Keystore 插件的最小接口（测试里用假的实现）。 */
export interface HardwareKeyWrapper {
  /** 已有就复用，没有就生成；返回实际的保护级别。 */
  ensureKey(): Promise<HardwareLevel>;
  wrap(raw: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  /** 失败时抛 HardwareKeyError */
  unwrap(wrapped: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  deleteKey(): Promise<void>;
}

/** 主密钥相关的落盘记录（在 secureinchat-master-key 库里）。 */
export interface MasterKeyRecords {
  getWrapped(): Promise<Uint8Array | undefined>;
  putWrapped(bytes: Uint8Array): Promise<void>;
  deleteWrapped(): Promise<void>;
  /** 旧做法的主密钥（CryptoKey 直接落盘），只读不建 */
  getLegacy(): Promise<CryptoKey | undefined>;
  deleteLegacy(): Promise<void>;
  /** 旧做法：没有就生成并存起来（Web 端、Keystore 不可用时用） */
  getOrCreateSoftwareKey(): Promise<CryptoKey>;
}

export interface MasterKeys {
  current: CryptoKey;
  /** 还没迁移完的旧主密钥；有它时把它交给 EncryptedKeyValueStore */
  legacy?: CryptoKey;
  protection: MasterKeyProtection;
}

const RECORD_VERSION = 1;
const LEVEL_CODES: HardwareLevel[] = ["strongbox", "tee", "software"];
const WRAP_AAD = new TextEncoder().encode("secureinchat:master-key:v1");

function encodeRecord(level: HardwareLevel, wrapped: Uint8Array): Uint8Array {
  const out = new Uint8Array(2 + wrapped.byteLength);
  out[0] = RECORD_VERSION;
  out[1] = LEVEL_CODES.indexOf(level);
  out.set(wrapped, 2);
  return out;
}

function decodeRecord(rec: Uint8Array): { level: HardwareLevel; wrapped: Uint8Array } {
  const level = LEVEL_CODES[rec[1] ?? -1];
  if (rec[0] !== RECORD_VERSION || !level || rec.byteLength < 3) {
    throw new MasterKeyUnavailableError("failed", "本机主密钥记录格式无法识别");
  }
  return { level, wrapped: rec.slice(2) };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let d = 0;
  for (let i = 0; i < a.byteLength; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

/**
 * 打开本机主密钥。wrapper 为 null 表示没有原生 Keystore（Web 端）。
 *
 * 顺序上的安全性：新主密钥的包裹记录 putWrapped 是唯一的提交点。在它之前崩溃，
 * 什么都没变（下次重来）；在它之后，旧密钥还在，两种条目都读得出。
 */
export async function openMasterKeys(
  wrapper: HardwareKeyWrapper | null,
  records: MasterKeyRecords
): Promise<MasterKeys> {
  const rec = await records.getWrapped();
  if (rec) {
    const { level, wrapped } = decodeRecord(rec);
    if (!wrapper) {
      throw new MasterKeyUnavailableError("missing", "本机数据由硬件密钥保护，但当前环境没有硬件密钥库");
    }
    let raw: Uint8Array;
    try {
      raw = await wrapper.unwrap(wrapped, WRAP_AAD);
    } catch (err) {
      const kind = err instanceof HardwareKeyError ? err.kind : "failed";
      throw new MasterKeyUnavailableError(kind, err instanceof Error ? err.message : "硬件密钥解包失败");
    }
    try {
      const current = await importAeadKeyRawNonExtractable(raw);
      const legacy = await records.getLegacy();
      return legacy ? { current, legacy, protection: level } : { current, protection: level };
    } finally {
      raw.fill(0);
    }
  }

  if (wrapper) {
    let level: HardwareLevel | undefined;
    try {
      level = await wrapper.ensureKey();
    } catch {
      level = undefined; // 这台设备的 Keystore 用不了：退回旧做法，界面显示较低的保护级别
    }
    if (level) {
      const raw = randomAeadKeyBytes();
      try {
        const wrapped = await wrapper.wrap(raw, WRAP_AAD);
        // 落盘前先解一次：包得上解不开的密钥一旦落盘，下次启动数据就全读不出了
        const check = await wrapper.unwrap(wrapped, WRAP_AAD);
        const ok = sameBytes(check, raw);
        check.fill(0);
        if (ok) {
          const current = await importAeadKeyRawNonExtractable(raw);
          await records.putWrapped(encodeRecord(level, wrapped));
          const legacy = await records.getLegacy();
          return legacy ? { current, legacy, protection: level } : { current, protection: level };
        }
      } catch {
        // 包裹或自检失败：同上，退回旧做法，不落盘任何新记录
      } finally {
        raw.fill(0);
      }
    }
  }

  return { current: await records.getOrCreateSoftwareKey(), protection: "webview" };
}

/** 迁移需要的那部分存储接口（EncryptedKeyValueStore 实现了它） */
export interface MigratableStore {
  readonly hasLegacyKey: boolean;
  migrateLegacy(): Promise<{ migrated: number; skipped: number }>;
  dropLegacyKey(): void;
}

/**
 * 后台迁移：把旧主密钥加密的条目全部改写，然后删除旧主密钥。
 * 任何一步失败就抛出、旧密钥保留，下次启动再来；重复执行是安全的。
 */
export async function finishLegacyMigration(
  store: MigratableStore,
  records: MasterKeyRecords
): Promise<{ migrated: number; skipped: number } | null> {
  if (!store.hasLegacyKey) return null;
  const result = await store.migrateLegacy();
  await records.deleteLegacy();
  store.dropLegacyKey();
  return result;
}

/**
 * 主密钥解不开时，用户确认后清空本机加密数据、重新开始（之后可以从备份恢复）。
 * keepPlainKeys 是不经过加密层的明文设置（应用锁、昵称等），保留；其余条目都是
 * 旧主密钥加密的、已经无法解开的密文，删除，否则启动后读取它们会报错。
 */
export async function resetMasterKeys(
  wrapper: HardwareKeyWrapper | null,
  records: MasterKeyRecords,
  backend: StorageBackend,
  keepPlainKeys: ReadonlySet<string>
): Promise<void> {
  for (const key of await backend.listKeys()) {
    if (!keepPlainKeys.has(key)) await backend.delete(key);
  }
  await records.deleteWrapped();
  await records.deleteLegacy();
  if (wrapper) {
    try {
      await wrapper.deleteKey();
    } catch {
      // 硬件密钥已经不在了（这正是常见的进到这一步的原因），无所谓
    }
  }
}
