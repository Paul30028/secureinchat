import { generateAeadKey } from "@secureinchat/crypto-core";
import { describe, expect, it } from "vitest";
import { EncryptedKeyValueStore } from "../src/encryptedKeyValueStore";
import {
  HardwareKeyError,
  MasterKeyUnavailableError,
  finishLegacyMigration,
  openMasterKeys,
  resetMasterKeys,
  type HardwareKeyWrapper,
  type HardwareLevel,
  type MasterKeyRecords,
} from "../src/masterKeyProvider";
import { TestOnlyInMemoryStorageBackend, type StorageBackend } from "../src/storageBackend";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : undefined);

/** 假的硬件密钥库：密钥只在这个对象里，模拟 Android Keystore。 */
class FakeWrapper implements HardwareKeyWrapper {
  key: CryptoKey | null = null;
  invalidated = false;
  failEnsure = false;
  corruptUnwrap = false;
  ensureCalls = 0;
  constructor(readonly level: HardwareLevel = "strongbox") {}

  async ensureKey(): Promise<HardwareLevel> {
    this.ensureCalls++;
    if (this.failEnsure) throw new Error("keystore broken");
    if (!this.key) {
      this.key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    return this.level;
  }
  async wrap(raw: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
    if (!this.key) throw new HardwareKeyError("missing", "no key");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, this.key, raw)
    );
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv);
    out.set(ct, 12);
    return out;
  }
  async unwrap(wrapped: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
    if (this.invalidated) throw new HardwareKeyError("invalidated", "key permanently invalidated");
    if (!this.key) throw new HardwareKeyError("missing", "no key");
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: wrapped.slice(0, 12), additionalData: aad },
        this.key,
        wrapped.slice(12)
      )
    );
    if (this.corruptUnwrap) plain[0] = plain[0]! ^ 1;
    return plain;
  }
  async deleteKey(): Promise<void> {
    this.key = null;
    this.invalidated = false;
  }
}

class FakeRecords implements MasterKeyRecords {
  wrapped: Uint8Array | undefined;
  legacy: CryptoKey | undefined;
  async getWrapped() {
    return this.wrapped;
  }
  async putWrapped(b: Uint8Array) {
    this.wrapped = b;
  }
  async deleteWrapped() {
    this.wrapped = undefined;
  }
  async getLegacy() {
    return this.legacy;
  }
  async deleteLegacy() {
    this.legacy = undefined;
  }
  async getOrCreateSoftwareKey() {
    if (!this.legacy) this.legacy = await generateAeadKey();
    return this.legacy;
  }
}

/** 第 failAfter 次 set 起抛错——模拟迁移中途断电 */
class FlakyBackend implements StorageBackend {
  sets = 0;
  failAfter = Infinity;
  constructor(readonly inner: TestOnlyInMemoryStorageBackend) {}
  get(k: string) {
    return this.inner.get(k);
  }
  async set(k: string, v: Uint8Array) {
    if (++this.sets > this.failAfter) throw new Error("power loss");
    return this.inner.set(k, v);
  }
  delete(k: string) {
    return this.inner.delete(k);
  }
  listKeys(p?: string) {
    return this.inner.listKeys(p);
  }
}

async function storeFor(backend: StorageBackend, wrapper: HardwareKeyWrapper | null, records: MasterKeyRecords) {
  const keys = await openMasterKeys(wrapper, records);
  return { keys, store: new EncryptedKeyValueStore(backend, keys.current, keys.legacy) };
}

/** 一台装了旧版本的设备：旧主密钥 + 若干旧条目 + 不经过加密层的明文设置 */
async function oldDevice(n = 6) {
  const backend = new TestOnlyInMemoryStorageBackend();
  const records = new FakeRecords();
  const legacy = await records.getOrCreateSoftwareKey();
  const old = new EncryptedKeyValueStore(backend, legacy);
  for (let i = 0; i < n; i++) await old.set(`messages:g${i}`, enc(`old-${i}`));
  await old.set("groups:joined", enc("[g0,g1]"));
  await backend.set("applock:v1", enc('{"enabled":true}')); // 明文设置
  return { backend, records, legacy };
}

describe("openMasterKeys", () => {
  it("fresh Android install: wraps a new key with the hardware key, no legacy key created", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper("tee");
    const { keys, store } = await storeFor(new TestOnlyInMemoryStorageBackend(), wrapper, records);
    expect(keys.protection).toBe("tee");
    expect(keys.legacy).toBeUndefined();
    expect(records.legacy).toBeUndefined();
    expect(records.wrapped).toBeDefined();
    expect(keys.current.extractable).toBe(false);
    await store.set("k", enc("v"));
    expect(dec(await store.get("k"))).toBe("v");
  });

  it("the stored record contains no raw key bytes that would open the data", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    const backend = new TestOnlyInMemoryStorageBackend();
    const { store } = await storeFor(backend, wrapper, records);
    await store.set("secret", enc("hello"));
    // Without the hardware key, the record alone cannot be unwrapped.
    wrapper.key = null;
    await expect(openMasterKeys(wrapper, records)).rejects.toMatchObject({ kind: "missing" });
  });

  it("restart: same key comes back from the wrapped record", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    const backend = new TestOnlyInMemoryStorageBackend();
    const a = await storeFor(backend, wrapper, records);
    await a.store.set("k", enc("persisted"));
    const b = await storeFor(backend, wrapper, records);
    expect(dec(await b.store.get("k"))).toBe("persisted");
    expect(b.keys.protection).toBe("strongbox");
  });

  it("web (no wrapper) keeps the old behaviour", async () => {
    const records = new FakeRecords();
    const { keys } = await storeFor(new TestOnlyInMemoryStorageBackend(), null, records);
    expect(keys.protection).toBe("webview");
    expect(records.wrapped).toBeUndefined();
  });

  it("Keystore unusable: falls back to the old behaviour and writes no wrapped record", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    wrapper.failEnsure = true;
    const { keys } = await storeFor(new TestOnlyInMemoryStorageBackend(), wrapper, records);
    expect(keys.protection).toBe("webview");
    expect(records.wrapped).toBeUndefined();
  });

  it("a wrap that does not round-trip is never committed", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    wrapper.corruptUnwrap = true;
    const { keys } = await storeFor(new TestOnlyInMemoryStorageBackend(), wrapper, records);
    expect(records.wrapped).toBeUndefined();
    expect(keys.protection).toBe("webview");
  });

  it("hardware key invalidated: typed error, never a silent new key", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    await openMasterKeys(wrapper, records);
    const before = records.wrapped;
    wrapper.invalidated = true;
    const err = await openMasterKeys(wrapper, records).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MasterKeyUnavailableError);
    expect((err as MasterKeyUnavailableError).kind).toBe("invalidated");
    expect(records.wrapped).toBe(before); // record untouched
  });

  it("hardware key missing (e.g. app data restored without the Keystore key)", async () => {
    const records = new FakeRecords();
    const wrapper = new FakeWrapper();
    await openMasterKeys(wrapper, records);
    const err = await openMasterKeys(new FakeWrapper(), records).catch((e: unknown) => e);
    expect((err as MasterKeyUnavailableError).kind).toBe("missing");
  });

  it("garbage record is reported, not overwritten", async () => {
    const records = new FakeRecords();
    records.wrapped = new Uint8Array([9, 9, 9]);
    const err = await openMasterKeys(new FakeWrapper(), records).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MasterKeyUnavailableError);
    expect(records.wrapped).toEqual(new Uint8Array([9, 9, 9]));
  });
});

describe("migration from the old master key", () => {
  it("upgrade: old entries readable immediately, new writes use the new key", async () => {
    const { backend, records, legacy } = await oldDevice();
    const { keys, store } = await storeFor(backend, new FakeWrapper(), records);
    expect(keys.legacy).toBe(legacy);
    expect(dec(await store.get("messages:g3"))).toBe("old-3");
    await store.set("messages:g3", enc("new-3"));
    // The new entry is not readable with the old key alone.
    const oldOnly = new EncryptedKeyValueStore(backend, legacy);
    await expect(oldOnly.get("messages:g3")).rejects.toThrow();
  });

  it("full migration rewrites every encrypted entry, leaves plaintext settings alone, deletes the old key", async () => {
    const { backend, records, legacy } = await oldDevice();
    const wrapper = new FakeWrapper();
    const { keys, store } = await storeFor(backend, wrapper, records);
    const result = await finishLegacyMigration(store, records);
    expect(result).toEqual({ migrated: 7, skipped: 1 });
    expect(records.legacy).toBeUndefined();
    expect(store.hasLegacyKey).toBe(false);
    expect(dec(await backend.get("applock:v1"))).toBe('{"enabled":true}');
    // Readable with only the new key, after a restart too.
    const fresh = await storeFor(backend, wrapper, records);
    expect(fresh.keys.legacy).toBeUndefined();
    for (let i = 0; i < 6; i++) expect(dec(await fresh.store.get(`messages:g${i}`))).toBe(`old-${i}`);
    // And no longer with the old key.
    await expect(new EncryptedKeyValueStore(backend, legacy).get("groups:joined")).rejects.toThrow();
    expect(keys.current).not.toBe(legacy);
  });

  it("interrupted midway: every entry stays readable, the old key is kept, a rerun finishes", async () => {
    const { backend: inner, records } = await oldDevice();
    const flaky = new FlakyBackend(inner);
    const wrapper = new FakeWrapper();
    const first = await storeFor(flaky, wrapper, records);
    flaky.failAfter = 3; // power cut after three rewrites
    await expect(finishLegacyMigration(first.store, records)).rejects.toThrow("power loss");
    expect(records.legacy).toBeDefined();

    // Next start: mixed old/new entries, all readable.
    flaky.failAfter = Infinity;
    const second = await storeFor(flaky, wrapper, records);
    expect(second.keys.legacy).toBeDefined();
    for (let i = 0; i < 6; i++) expect(dec(await second.store.get(`messages:g${i}`))).toBe(`old-${i}`);
    const result = await finishLegacyMigration(second.store, records);
    expect(result?.migrated).toBe(4); // 7 encrypted entries, 3 already rewritten
    expect(records.legacy).toBeUndefined();
    const third = await storeFor(flaky, wrapper, records);
    expect(dec(await third.store.get("groups:joined"))).toBe("[g0,g1]");
  });

  it("a write landing between migration's read and rewrite of the same entry is not lost", async () => {
    const { backend: inner, records } = await oldDevice();
    // Fires the app's write at the exact moment migration has read messages:g2's old value.
    let fire: (() => void) | null = null;
    const hooked: StorageBackend = {
      get: async (k) => {
        const v = await inner.get(k);
        if (k === "messages:g2" && fire) {
          const f = fire;
          fire = null;
          f();
        }
        return v;
      },
      set: (k, v) => inner.set(k, v),
      delete: (k) => inner.delete(k),
      listKeys: (p) => inner.listKeys(p),
    };
    const { store } = await storeFor(hooked, new FakeWrapper(), records);
    let appWrite: Promise<void> = Promise.resolve();
    fire = () => {
      appWrite = store.set("messages:g2", enc("written-during-migration"));
    };
    await finishLegacyMigration(store, records);
    await appWrite;
    expect(fire).toBeNull(); // the hook really fired
    expect(dec(await store.get("messages:g2"))).toBe("written-during-migration");
  });

  it("running migration twice is harmless", async () => {
    const { backend, records } = await oldDevice();
    const { store } = await storeFor(backend, new FakeWrapper(), records);
    await finishLegacyMigration(store, records);
    expect(await finishLegacyMigration(store, records)).toBeNull();
    expect(dec(await store.get("messages:g0"))).toBe("old-0");
  });

  it("an entry tampered with is still reported as an error, not returned as undefined", async () => {
    const { backend, records } = await oldDevice();
    const { store } = await storeFor(backend, new FakeWrapper(), records);
    const packed = (await backend.get("messages:g1"))!;
    packed[packed.length - 1] = packed[packed.length - 1]! ^ 1;
    await backend.set("messages:g1", packed);
    await expect(store.get("messages:g1")).rejects.toThrow();
  });
});

describe("resetMasterKeys", () => {
  it("clears unreadable ciphertext, keeps plaintext settings, starts with a new hardware key", async () => {
    const { backend, records } = await oldDevice();
    const wrapper = new FakeWrapper();
    const { store } = await storeFor(backend, wrapper, records);
    await finishLegacyMigration(store, records);
    wrapper.invalidated = true;
    await expect(openMasterKeys(wrapper, records)).rejects.toBeInstanceOf(MasterKeyUnavailableError);

    await resetMasterKeys(wrapper, records, backend, new Set(["applock:v1"]));
    expect((await backend.listKeys()).sort()).toEqual(["applock:v1"]);
    const after = await storeFor(backend, wrapper, records);
    expect(after.keys.protection).toBe("strongbox");
    expect(await after.store.get("groups:joined")).toBeUndefined();
    await after.store.set("groups:joined", enc("[]"));
    expect(dec(await after.store.get("groups:joined"))).toBe("[]");
  });
});
