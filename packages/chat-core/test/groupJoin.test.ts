import { generateAeadKey, deriveGroupEpochKey } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import { describe, expect, it } from "vitest";
import { joinGroupFromInvite, MissingGroupIdError, storageKeyForGroupEpoch } from "../src/groupJoin";

function makeStore() {
  const backend = new TestOnlyInMemoryStorageBackend();
  return { backend, storePromise: generateAeadKey().then((k) => new EncryptedKeyValueStore(backend, k)) };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("joinGroupFromInvite", () => {
  it("throws MissingGroupIdError for an invite without groupId (SIC1-shaped)", async () => {
    const { storePromise } = makeStore();
    const store = await storePromise;
    await expect(
      joinGroupFromInvite({ groupId: undefined, keyMaterialB64Url: "abc", epoch: 0 }, store)
    ).rejects.toThrow(MissingGroupIdError);
  });

  it("derives and stores a key retrievable at the documented storage key", async () => {
    const { backend, storePromise } = makeStore();
    const store = await storePromise;
    const rawMaterial = crypto.getRandomValues(new Uint8Array(32));

    const result = await joinGroupFromInvite(
      { groupId: "group-1", keyMaterialB64Url: toBase64Url(rawMaterial), epoch: 0 },
      store
    );

    expect(result.groupId).toBe("group-1");
    expect(result.epoch).toBe(0);
    expect(result.storageKey).toBe(storageKeyForGroupEpoch("group-1", 0));
    expect(await backend.get(result.storageKey)).toBeDefined(); // something really got persisted
  });

  it("the stored key matches deriveGroupEpochKey computed independently (no silent mismatch)", async () => {
    const { storePromise } = makeStore();
    const store = await storePromise;
    const rawMaterial = crypto.getRandomValues(new Uint8Array(32));
    const keyMaterialB64Url = toBase64Url(rawMaterial);

    await joinGroupFromInvite({ groupId: "group-1", keyMaterialB64Url, epoch: 2 }, store);
    const retrieved = await store.get(storageKeyForGroupEpoch("group-1", 2));

    const independentlyDerived = await deriveGroupEpochKey({ rawKeyMaterial: rawMaterial, groupId: "group-1", epoch: 2 });
    const independentlyDerivedRaw = await crypto.subtle.exportKey("raw", independentlyDerived);

    expect(retrieved).toBeDefined();
    expect(Array.from(retrieved!)).toEqual(Array.from(new Uint8Array(independentlyDerivedRaw)));
  });

  it("defaults epoch to 0 when the invite doesn't specify one", async () => {
    const { storePromise } = makeStore();
    const store = await storePromise;
    const result = await joinGroupFromInvite({ groupId: "group-1", keyMaterialB64Url: "YWJj", epoch: undefined }, store);
    expect(result.epoch).toBe(0);
  });

  it("different groupIds with the same key material produce different stored keys", async () => {
    const { storePromise } = makeStore();
    const store = await storePromise;
    const rawMaterial = crypto.getRandomValues(new Uint8Array(32));
    const km = toBase64Url(rawMaterial);

    await joinGroupFromInvite({ groupId: "group-A", keyMaterialB64Url: km, epoch: 0 }, store);
    await joinGroupFromInvite({ groupId: "group-B", keyMaterialB64Url: km, epoch: 0 }, store);

    const keyA = await store.get(storageKeyForGroupEpoch("group-A", 0));
    const keyB = await store.get(storageKeyForGroupEpoch("group-B", 0));
    expect(Array.from(keyA!)).not.toEqual(Array.from(keyB!));
  });
});
