import { describe, expect, it } from "vitest";
import { generateAeadKey, TestOnlyInMemoryKeystore } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import {
  getOrCreateGroupIdentity,
  forgetGroupIdentity,
  storageKeyForGroupIdentity,
  keystoreAliasForGroup,
} from "../src/groupIdentity";
import { InvalidGroupIdError } from "../src/groupId";
import { purgeGroupLocalData } from "../src/groupPurge";
import { upsertGroup, type JoinedGroup } from "../src/groupStore";

async function setup() {
  const store = new EncryptedKeyValueStore(new TestOnlyInMemoryStorageBackend(), await generateAeadKey());
  return { store, keystore: new TestOnlyInMemoryKeystore() };
}

describe("getOrCreateGroupIdentity", () => {
  it("gives two groups different device ids and different public keys", async () => {
    const { store, keystore } = await setup();
    const a = await getOrCreateGroupIdentity(store, keystore, "gA");
    const b = await getOrCreateGroupIdentity(store, keystore, "gB");
    expect(a.deviceId).not.toBe(b.deviceId);
    expect(a.deviceId).toMatch(/^device-/);
    const pa = await keystore.exportPublicKeyRaw(a.keystoreAlias);
    const pb = await keystore.exportPublicKeyRaw(b.keystoreAlias);
    expect(Buffer.from(pa).equals(Buffer.from(pb))).toBe(false);
  });

  it("returns the same identity for the same group", async () => {
    const { store, keystore } = await setup();
    const first = await getOrCreateGroupIdentity(store, keystore, "gA");
    const pk1 = await keystore.exportPublicKeyRaw(first.keystoreAlias);
    const again = await getOrCreateGroupIdentity(store, keystore, "gA");
    expect(again).toEqual(first);
    expect(Buffer.from(await keystore.exportPublicKeyRaw(again.keystoreAlias)).equals(Buffer.from(pk1))).toBe(true);
  });

  it("after forget, a new device id and key are created; other groups are untouched", async () => {
    const { store, keystore } = await setup();
    const a = await getOrCreateGroupIdentity(store, keystore, "gA");
    const b = await getOrCreateGroupIdentity(store, keystore, "gB");
    await forgetGroupIdentity(store, keystore, "gA");
    expect(await store.get(storageKeyForGroupIdentity("gA"))).toBeUndefined();
    await expect(keystore.sign(keystoreAliasForGroup("gA"), new Uint8Array([1]))).rejects.toThrow();

    const a2 = await getOrCreateGroupIdentity(store, keystore, "gA");
    expect(a2.deviceId).not.toBe(a.deviceId);
    expect(await getOrCreateGroupIdentity(store, keystore, "gB")).toEqual(b);
  });

  it("rejects an invalid group id", async () => {
    const { store, keystore } = await setup();
    await expect(getOrCreateGroupIdentity(store, keystore, "")).rejects.toBeInstanceOf(InvalidGroupIdError);
    await expect(forgetGroupIdentity(store, keystore, "a:b")).rejects.toBeInstanceOf(InvalidGroupIdError);
  });

  it("purgeGroupLocalData removes the stored group identity", async () => {
    const { store, keystore } = await setup();
    await getOrCreateGroupIdentity(store, keystore, "gA");
    const report = await purgeGroupLocalData(store, "gA");
    expect(report.deletedKeys).toContain("identity:gA");
    expect(report.remainingKeys).toEqual([]);
  });
});

describe("upsertGroup keeps the identity scope chosen at join time", () => {
  const base: JoinedGroup = { groupId: "g", groupName: "n", keyMaterialB64Url: "k", epoch: 0, joinedAtMs: 1, lastReadAtMs: 1 };
  it("an old group stays old when re-joined with a new-style record", () => {
    const out = upsertGroup([base], { ...base, groupName: "n2", identityScope: "group" });
    expect(out[0]!.identityScope).toBeUndefined();
    expect(out[0]!.groupName).toBe("n2");
  });
  it("a new group stays new", () => {
    const out = upsertGroup([{ ...base, identityScope: "group" }], { ...base, epoch: 1 });
    expect(out[0]!.identityScope).toBe("group");
  });
});
