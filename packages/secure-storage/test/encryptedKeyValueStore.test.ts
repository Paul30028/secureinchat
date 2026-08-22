import { generateAeadKey } from "@secureinchat/crypto-core";
import { describe, expect, it } from "vitest";
import { EncryptedKeyValueStore } from "../src/encryptedKeyValueStore";
import { TestOnlyInMemoryStorageBackend } from "../src/storageBackend";

async function makeStore(masterKey?: CryptoKey) {
  const backend = new TestOnlyInMemoryStorageBackend();
  const key = masterKey ?? (await generateAeadKey());
  return { backend, store: new EncryptedKeyValueStore(backend, key), key };
}

describe("EncryptedKeyValueStore — happy path", () => {
  it("round-trips a value", async () => {
    const { store } = await makeStore();
    await store.set("profile:nickname", new TextEncoder().encode("张溪"));
    const value = await store.get("profile:nickname");
    expect(new TextDecoder().decode(value)).toBe("张溪");
  });

  it("returns undefined for a key that was never set", async () => {
    const { store } = await makeStore();
    expect(await store.get("does-not-exist")).toBeUndefined();
  });

  it("delete removes the value", async () => {
    const { store } = await makeStore();
    await store.set("k", new TextEncoder().encode("v"));
    await store.delete("k");
    expect(await store.get("k")).toBeUndefined();
  });

  it("listKeys respects the prefix filter", async () => {
    const { store } = await makeStore();
    await store.set("group:1:name", new TextEncoder().encode("a"));
    await store.set("group:2:name", new TextEncoder().encode("b"));
    await store.set("profile:nickname", new TextEncoder().encode("c"));
    const keys = await store.listKeys("group:");
    expect(keys.sort()).toEqual(["group:1:name", "group:2:name"]);
  });
});

describe("EncryptedKeyValueStore — abuse cases (write these before trusting the happy path)", () => {
  it("never stores plaintext on the backend (backend only sees ciphertext bytes)", async () => {
    const { store, backend } = await makeStore();
    const secret = "机密内容不应该明文落盘";
    await store.set("secret", new TextEncoder().encode(secret));
    const raw = await backend.get("secret");
    const rawAsText = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    expect(rawAsText).not.toContain(secret);
  });

  it("rejects a ciphertext moved from one key to another (key-swap / confused deputy attack)", async () => {
    const { store, backend } = await makeStore();
    await store.set("account:A:token", new TextEncoder().encode("token-for-A"));

    // Attacker (or a bug) copies the raw ciphertext bytes under A's key over to B's key.
    const rawA = await backend.get("account:A:token");
    await backend.set("account:B:token", rawA!);

    // Because the AAD binds the ciphertext to its original key name, decrypting
    // under the new key name must fail rather than silently returning A's token.
    await expect(store.get("account:B:token")).rejects.toThrow();
  });

  it("rejects tampered ciphertext bytes", async () => {
    const { store, backend } = await makeStore();
    await store.set("k", new TextEncoder().encode("original"));
    const raw = await backend.get("k");
    const tampered = new Uint8Array(raw!);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    await backend.set("k", tampered);
    await expect(store.get("k")).rejects.toThrow();
  });

  it("rejects data when opened with the wrong master key (e.g. wrong device / restored backup)", async () => {
    const { backend } = await makeStore();
    const keyA = await generateAeadKey();
    const keyB = await generateAeadKey();
    const storeA = new EncryptedKeyValueStore(backend, keyA);
    const storeB = new EncryptedKeyValueStore(backend, keyB);

    await storeA.set("k", new TextEncoder().encode("only for keyA"));
    await expect(storeB.get("k")).rejects.toThrow();
  });
});
