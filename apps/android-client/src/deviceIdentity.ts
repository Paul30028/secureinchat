import {
  BrowserKeystore,
  deletePersistentEntry,
  getOrCreatePersistentAeadKey,
  getPersistentAeadKeyIfExists,
  getPersistentBytes,
  putPersistentBytes,
  randomUUID,
} from "@secureinchat/crypto-core";
import {
  EncryptedKeyValueStore,
  IndexedDbStorageBackend,
  finishLegacyMigration,
  openMasterKeys,
  resetMasterKeys,
  type MasterKeyProtection,
  type MasterKeyRecords,
} from "@secureinchat/secure-storage";
import { nativeHardwareKeyWrapper } from "./hardwareKeystore";

/**
 * 设备身份和本机加密存储。
 *
 * 主密钥（加密群密钥、消息等）：
 * - Android 原生（C10-A）：由 Android Keystore 的硬件密钥包裹，落盘的只有包裹后的字节，
 *   见 secure-storage 的 masterKeyProvider.ts。从旧版本升级时，旧主密钥保留到后台迁移完成。
 * - Web 端：不可导出的 CryptoKey 直接存 IndexedDB（原来的做法），保护级别较低。
 *
 * - `BrowserKeystore` 用不可导出的 Web Crypto 密钥，密钥对象直接存 IndexedDB，
 *   同一个 alias 刷新页面后还是同一把密钥（设备签名密钥；硬件化是后续里程碑）
 * - `IndexedDbStorageBackend` 让加密后的群密钥也能跨刷新保留
 */
/** 旧做法的主密钥（CryptoKey 直接落盘）；Web 端一直用它，Android 上迁移完成后删除 */
const MASTER_KEY_ALIAS = "device-identity:master-key";
/** C10-A：被硬件密钥包裹后的主密钥（字节） */
const WRAPPED_MASTER_KEY_ALIAS = "device-identity:master-key:hw-v1";

/**
 * 不经过加密层、直接存在同一个库里的明文设置。主密钥解不开、用户选择重新开始时保留它们，
 * 其余条目（全是旧主密钥加密的密文）删除。新增明文设置时要加到这里——
 * deviceIdentity.test.ts 会扫描源码检查。
 */
export const PLAINTEXT_SETTING_KEYS: ReadonlySet<string> = new Set([
  "device-identity:device-id",
  "applock:v1",
  "biometricunlock:v1",
  "screensecurity:v1",
  "settings:relay-url",
  "profile:nickname",
  "admin:unlocked",
]);

const records: MasterKeyRecords = {
  getWrapped: () => getPersistentBytes(WRAPPED_MASTER_KEY_ALIAS),
  putWrapped: (b) => putPersistentBytes(WRAPPED_MASTER_KEY_ALIAS, b),
  deleteWrapped: () => deletePersistentEntry(WRAPPED_MASTER_KEY_ALIAS),
  getLegacy: () => getPersistentAeadKeyIfExists(MASTER_KEY_ALIAS),
  deleteLegacy: () => deletePersistentEntry(MASTER_KEY_ALIAS),
  getOrCreateSoftwareKey: () => getOrCreatePersistentAeadKey(MASTER_KEY_ALIAS),
};

let storePromise: Promise<EncryptedKeyValueStore> | null = null;
let protection: MasterKeyProtection | null = null;

/**
 * 主密钥解不开时 reject 一个 MasterKeyUnavailableError（不会悄悄换新密钥）。
 * 界面据此引导「清空本机数据并从备份恢复」，见 resetLocalEncryptedData()。
 */
export function getDeviceStore(): Promise<EncryptedKeyValueStore> {
  if (!storePromise) {
    const p = (async () => {
      const keys = await openMasterKeys(nativeHardwareKeyWrapper(), records);
      protection = keys.protection;
      const store = new EncryptedKeyValueStore(new IndexedDbStorageBackend(), keys.current, keys.legacy);
      if (store.hasLegacyKey) {
        // 后台迁移，不挡启动。失败时旧密钥保留，下次启动再来（重复执行是安全的）。
        setTimeout(() => {
          void finishLegacyMigration(store, records).catch(() => undefined);
        }, 0);
      }
      return store;
    })();
    storePromise = p;
    // 失败的结果不缓存：用户点「重试」时重新打开
    p.catch(() => {
      if (storePromise === p) storePromise = null;
    });
  }
  return storePromise;
}

/** 本机数据的保护级别（打开存储之后才知道）；还没打开时为 null。 */
export function getMasterKeyProtection(): MasterKeyProtection | null {
  return protection;
}

/**
 * 主密钥解不开时，用户确认后调用：删除已经无法解开的密文（保留明文设置）、
 * 删掉主密钥记录和硬件密钥，下一次 getDeviceStore() 用新密钥重新开始。
 * 之后可以从备份恢复群和消息。
 */
export async function resetLocalEncryptedData(): Promise<void> {
  await resetMasterKeys(
    nativeHardwareKeyWrapper(),
    records,
    new IndexedDbStorageBackend(),
    PLAINTEXT_SETTING_KEYS
  );
  storePromise = null;
  protection = null;
}

export interface DeviceIdentity {
  deviceId: string;
  keystore: BrowserKeystore;
  keystoreAlias: string;
}

const DEVICE_ID_STORAGE_KEY = "device-identity:device-id";
const DEVICE_ID_ALIAS = "device-identity:signing-key";

let identityPromise: Promise<DeviceIdentity> | null = null;

export function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (!identityPromise) {
    identityPromise = (async () => {
      const keystore = new BrowserKeystore();
      // deviceId 本身不是秘密，直接存在 IndexedDB 里（不经过 EncryptedKeyValueStore
      // 加密也没关系——它只是个标识符，泄露了也不会让人拿到密钥）。
      const backend = new IndexedDbStorageBackend();
      let deviceId: string;
      const existing = await backend.get(DEVICE_ID_STORAGE_KEY);
      if (existing) {
        deviceId = new TextDecoder().decode(existing);
      } else {
        deviceId = `device-${randomUUID()}`;
        await backend.set(DEVICE_ID_STORAGE_KEY, new TextEncoder().encode(deviceId));
      }
      // BrowserKeystore.generateDeviceKeyPair 对同一个 alias 是幂等的（已存在就
      // 复用），所以这里每次都"生成"也没问题——不会覆盖已有身份。
      const keystoreAlias = await keystore.generateDeviceKeyPair(DEVICE_ID_ALIAS);
      return { deviceId, keystore, keystoreAlias };
    })();
  }
  return identityPromise;
}

/**
 * 仅供测试：清掉模块级缓存，让下一次调用重新读一遍存储。
 *
 * 生产代码不该调用这个——设备身份和主密钥在一次运行内应该是稳定的。
 * 但测试需要每个用例都是"一台全新的设备"，否则上一个测试加入的群会
 * 出现在下一个测试的群列表里。
 */
export function __resetForTests(): void {
  storePromise = null;
  identityPromise = null;
  protection = null;
}
