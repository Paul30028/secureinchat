import { getOrCreatePersistentAeadKey, BrowserKeystore, randomUUID } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * Web 端的设备身份/存储实现。不是 Android 硬件 Keystore（真机版本需要一个原生
 * Capacitor 插件），但也不再是"每次刷新页面都换一个新身份"的内存态替身：
 * - `BrowserKeystore` 用不可导出的 Web Crypto 密钥，密钥对象直接存 IndexedDB，
 *   同一个 alias 刷新页面后还是同一把密钥
 * - `IndexedDbStorageBackend` 让加密后的群密钥也能跨刷新保留
 * - `getOrCreatePersistentAeadKey` 让"用来加密那些群密钥的主密钥"本身也不会
 *   每次刷新就换掉——这是最初这几块接起来时漏掉的一环：主密钥不持久化的话，
 *   落盘的密文下次读不出来，等于白存
 */
const MASTER_KEY_ALIAS = "device-identity:master-key";

let storePromise: Promise<EncryptedKeyValueStore> | null = null;

export function getDeviceStore(): Promise<EncryptedKeyValueStore> {
  if (!storePromise) {
    storePromise = getOrCreatePersistentAeadKey(MASTER_KEY_ALIAS).then((masterKey) => {
      const backend = new IndexedDbStorageBackend();
      return new EncryptedKeyValueStore(backend, masterKey);
    });
  }
  return storePromise;
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
}
