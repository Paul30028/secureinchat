import { generateAeadKey, TestOnlyInMemoryKeystore } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";

/**
 * ⚠️ 这不是生产实现。真正的"设备主密钥"和"设备身份密钥对"都要来自 Android
 * Keystore（通过一个原生 Capacitor 插件实现 crypto-core 的 `KeystorePort`），
 * 这里用 Web Crypto 生成替身——和 crypto-core 自己的 `TestOnlyInMemoryKeystore`
 * 一个思路。设备身份是每次页面加载都重新生成的（内存态，刷新就换了新身份），
 * 不是持久化的设备标识——真机上这是必须解决的事，这里先明确标注不是。
 *
 * 同样，底层存储用的是 `TestOnlyInMemoryStorageBackend`：进程/页面一刷新数据就没了，
 * 只用来证明"密钥派生 → 加密落盘"这条链路是通的，不能真当持久化用。
 */
let storePromise: Promise<EncryptedKeyValueStore> | null = null;

export function getDeviceStore(): Promise<EncryptedKeyValueStore> {
  if (!storePromise) {
    storePromise = generateAeadKey().then((masterKey) => {
      const backend = new TestOnlyInMemoryStorageBackend();
      return new EncryptedKeyValueStore(backend, masterKey);
    });
  }
  return storePromise;
}

export interface DeviceIdentity {
  deviceId: string;
  keystore: TestOnlyInMemoryKeystore;
  keystoreAlias: string;
}

let identityPromise: Promise<DeviceIdentity> | null = null;

export function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (!identityPromise) {
    identityPromise = (async () => {
      const deviceId = `device-${crypto.randomUUID()}`;
      const keystore = new TestOnlyInMemoryKeystore();
      const keystoreAlias = await keystore.generateDeviceKeyPair(deviceId);
      return { deviceId, keystore, keystoreAlias };
    })();
  }
  return identityPromise;
}
