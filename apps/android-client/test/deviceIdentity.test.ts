import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrCreatePersistentAeadKey,
  getPersistentAeadKeyIfExists,
  getPersistentBytes,
} from "@secureinchat/crypto-core";
import {
  EncryptedKeyValueStore,
  HardwareKeyError,
  IndexedDbStorageBackend,
  MasterKeyUnavailableError,
  type HardwareKeyWrapper,
  type HardwareLevel,
} from "@secureinchat/secure-storage";

/** 假的 Android Keystore（真实加密，密钥只在内存里）。null = 模拟 Web 端。 */
class FakeKeystore implements HardwareKeyWrapper {
  key: CryptoKey | null = null;
  invalidated = false;
  async ensureKey(): Promise<HardwareLevel> {
    if (!this.key) {
      this.key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    return "strongbox";
  }
  async wrap(raw: Uint8Array, aad: Uint8Array) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, this.key!, raw));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return out;
  }
  async unwrap(w: Uint8Array, aad: Uint8Array) {
    if (this.invalidated) throw new HardwareKeyError("invalidated", "invalidated");
    if (!this.key) throw new HardwareKeyError("missing", "missing");
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: w.slice(0, 12), additionalData: aad }, this.key, w.slice(12))
    );
  }
  async deleteKey() {
    this.key = null;
    this.invalidated = false;
  }
}

let keystore: FakeKeystore | null = null;
vi.mock("../src/hardwareKeystore", () => ({ nativeHardwareKeyWrapper: () => keystore }));

const { getDeviceStore, getMasterKeyProtection, resetLocalEncryptedData, PLAINTEXT_SETTING_KEYS, __resetForTests } =
  await import("../src/deviceIdentity");

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : undefined);

/** Empties an object store. (Deleting the databases would block: the modules keep connections open.) */
function clearStore(dbName: string, storeName: string) {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(storeName);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function waitFor(cond: () => Promise<boolean>) {
  for (let i = 0; i < 100; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("timed out");
}

beforeEach(async () => {
  __resetForTests();
  keystore = null;
  await clearStore("secureinchat-master-key", "keys");
  await clearStore("secureinchat-storage", "kv");
});

describe("getDeviceStore on Android (C10-A)", () => {
  it("upgrade from the old version: data stays readable, migrates in the background, old key deleted", async () => {
    // The old version: master key as a CryptoKey in IndexedDB, data encrypted with it.
    const legacy = await getOrCreatePersistentAeadKey("device-identity:master-key");
    const backend = new IndexedDbStorageBackend();
    const old = new EncryptedKeyValueStore(backend, legacy);
    await old.set("groups:joined", enc('[{"groupId":"g1"}]'));
    await old.set("messages:g1", enc("hello"));
    await backend.set("applock:v1", enc('{"enabled":true}'));

    keystore = new FakeKeystore();
    const store = await getDeviceStore();
    expect(getMasterKeyProtection()).toBe("strongbox");
    expect(dec(await store.get("groups:joined"))).toBe('[{"groupId":"g1"}]');

    await waitFor(async () => (await getPersistentAeadKeyIfExists("device-identity:master-key")) === undefined);
    expect(store.hasLegacyKey).toBe(false);
    expect(dec(await store.get("messages:g1"))).toBe("hello");
    expect(dec(await backend.get("applock:v1"))).toBe('{"enabled":true}');

    // Restart: only the wrapped record remains, and it opens the data.
    __resetForTests();
    const again = await getDeviceStore();
    expect(dec(await again.get("messages:g1"))).toBe("hello");
    // The stored master-key record is bytes, not a CryptoKey (old WebViews cannot store CryptoKey).
    expect(await getPersistentBytes("device-identity:master-key:hw-v1")).toBeInstanceOf(Uint8Array);
  });

  it("hardware key gone: a typed error, and Retry works once the cause is fixed", async () => {
    keystore = new FakeKeystore();
    await (await getDeviceStore()).set("messages:g1", enc("hi"));
    __resetForTests();
    keystore.invalidated = true;
    const err = await getDeviceStore().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MasterKeyUnavailableError);
    // The failure is not cached.
    keystore.invalidated = false;
    expect(dec(await (await getDeviceStore()).get("messages:g1"))).toBe("hi");
  });

  it("reset after a lost key: unreadable data cleared, settings kept, new key works", async () => {
    keystore = new FakeKeystore();
    const backend = new IndexedDbStorageBackend();
    await (await getDeviceStore()).set("groups:joined", enc("[g]"));
    await backend.set("profile:nickname", enc("溪"));
    __resetForTests();
    keystore.key = null; // e.g. app data restored onto a phone without the Keystore key
    await expect(getDeviceStore()).rejects.toMatchObject({ kind: "missing" });

    await resetLocalEncryptedData();
    const store = await getDeviceStore();
    expect(await store.get("groups:joined")).toBeUndefined();
    expect(dec(await backend.get("profile:nickname"))).toBe("溪");
    expect(getMasterKeyProtection()).toBe("strongbox");
  });
});

describe("getDeviceStore on the web", () => {
  it("keeps the old behaviour and reports the lower protection", async () => {
    const store = await getDeviceStore();
    await store.set("k", enc("v"));
    expect(getMasterKeyProtection()).toBe("webview");
    expect(await getPersistentAeadKeyIfExists("device-identity:master-key")).toBeDefined();
  });
});

describe("PLAINTEXT_SETTING_KEYS", () => {
  it("lists every key that src/ writes straight to IndexedDbStorageBackend", () => {
    const dir = join(__dirname, "../src");
    const found: string[] = [];
    for (const name of readdirSync(dir)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const src = readFileSync(join(dir, name), "utf8");
      if (!src.includes("new IndexedDbStorageBackend()")) continue;
      for (const m of src.matchAll(/const [A-Z_]*KEY = "([^"]+)"/g)) found.push(m[1]!);
    }
    expect(found.length).toBeGreaterThanOrEqual(7);
    for (const k of found) expect(PLAINTEXT_SETTING_KEYS.has(k), `${k} missing from PLAINTEXT_SETTING_KEYS`).toBe(true);
  });
});
