import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getOrCreatePersistentAeadKey } from "../src/persistentMasterKey";
import { encryptAead, decryptAead } from "../src/aead";

describe("getOrCreatePersistentAeadKey", () => {
  it("returns a usable AES-GCM key", async () => {
    const key = await getOrCreatePersistentAeadKey("test-alias");
    const aad = new Uint8Array();
    const ct = await encryptAead(key, new TextEncoder().encode("hello"), aad);
    const pt = await decryptAead(key, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("hello");
  });

  it("reuses the same key on a second call with the same alias (does not overwrite)", async () => {
    const first = await getOrCreatePersistentAeadKey("test-alias");
    const aad = new Uint8Array();
    const ct = await encryptAead(first, new TextEncoder().encode("secret"), aad);

    const second = await getOrCreatePersistentAeadKey("test-alias");
    // If it were a *different* key, this decrypt would throw.
    const pt = await decryptAead(second, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("secret");
  });

  it("different aliases produce independent keys", async () => {
    const keyA = await getOrCreatePersistentAeadKey("alias-A");
    const keyB = await getOrCreatePersistentAeadKey("alias-B");
    const aad = new Uint8Array();
    const ct = await encryptAead(keyA, new TextEncoder().encode("only for A"), aad);
    await expect(decryptAead(keyB, ct, aad)).rejects.toThrow();
  });

  it("the key survives being fetched fresh (simulates a page reload) and can still decrypt data encrypted before reload", async () => {
    const beforeReload = await getOrCreatePersistentAeadKey("persisted-alias");
    const aad = new Uint8Array();
    const ct = await encryptAead(beforeReload, new TextEncoder().encode("still readable after reload"), aad);

    // Nothing shared with `beforeReload` except the same IndexedDB alias —
    // this is the actual scenario that was broken before this fix: the master
    // key regenerating on every load meant previously-encrypted data became
    // permanently undecryptable.
    const afterReload = await getOrCreatePersistentAeadKey("persisted-alias");
    const pt = await decryptAead(afterReload, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("still readable after reload");
  });
});
