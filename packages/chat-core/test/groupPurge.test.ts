import { describe, expect, it } from "vitest";
import { generateAeadKey } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import {
  purgeGroupLocalData,
  storageKeyForAdminKey,
  InvalidGroupIdError,
} from "../src/groupPurge";
import { loadJoinedGroups, saveJoinedGroups, type JoinedGroup } from "../src/groupStore";
import { storageKeyForGroupMessages } from "../src/messageStore";
import { storageKeyForDevices } from "../src/knownDevices";
import { storageKeyForGroupEpoch } from "../src/groupJoin";

async function makeStore() {
  const backend = new TestOnlyInMemoryStorageBackend();
  return { backend, store: new EncryptedKeyValueStore(backend, await generateAeadKey()) };
}

function group(groupId: string): JoinedGroup {
  return { groupId, groupName: groupId, keyMaterialB64Url: "k", epoch: 2, joinedAtMs: 1, lastReadAtMs: 1 };
}

const bytes = new TextEncoder().encode("x");

async function seedGroup(store: EncryptedKeyValueStore, gid: string, epochs = [0, 1, 2]) {
  for (const e of epochs) await store.set(storageKeyForGroupEpoch(gid, e), bytes);
  await store.set(storageKeyForAdminKey(gid), bytes);
  await store.set(storageKeyForGroupMessages(gid), bytes);
  await store.set(storageKeyForDevices(gid), bytes);
}

describe("purgeGroupLocalData", () => {
  it("deletes every epoch key, the admin key, messages, devices and the list entry", async () => {
    const { store } = await makeStore();
    await seedGroup(store, "g1");
    await saveJoinedGroups(store, [group("g1")]);

    const report = await purgeGroupLocalData(store, "g1");

    expect(report.deletedKeys).toEqual([
      "group:g1:epoch:0",
      "group:g1:epoch:1",
      "group:g1:epoch:2",
      "admin-key:g1",
      "messages:g1",
      "devices:g1",
    ]);
    expect(report.remainingKeys).toEqual([]);
    expect(await loadJoinedGroups(store)).toEqual([]);
    expect((await store.listKeys()).filter((k) => k.includes("g1"))).toEqual([]);
  });

  it("leaves other groups untouched, including one whose id starts with the same characters", async () => {
    const { store } = await makeStore();
    await seedGroup(store, "g1");
    await seedGroup(store, "g10");
    await saveJoinedGroups(store, [group("g1"), group("g10")]);

    await purgeGroupLocalData(store, "g1");

    const keys = await store.listKeys();
    expect(keys).toContain("group:g10:epoch:0");
    expect(keys).toContain("admin-key:g10");
    expect(keys).toContain("messages:g10");
    expect(keys).toContain("devices:g10");
    expect((await loadJoinedGroups(store)).map((g) => g.groupId)).toEqual(["g10"]);
  });

  it("can run twice (resume after an interrupted purge)", async () => {
    const { store } = await makeStore();
    await seedGroup(store, "g1");
    await saveJoinedGroups(store, [group("g1")]);
    await purgeGroupLocalData(store, "g1");

    const second = await purgeGroupLocalData(store, "g1");
    expect(second.deletedKeys).toEqual([]);
    expect(second.remainingKeys).toEqual([]);
  });

  it("finishes a group whose keys were deleted but whose list entry survived", async () => {
    const { store } = await makeStore();
    await saveJoinedGroups(store, [group("g1"), group("g2")]);

    await purgeGroupLocalData(store, "g1");
    expect((await loadJoinedGroups(store)).map((g) => g.groupId)).toEqual(["g2"]);
  });

  it("reports keys for the group that it does not know how to delete", async () => {
    const { store } = await makeStore();
    await seedGroup(store, "g1");
    await store.set("future-feature:g1", bytes);

    const report = await purgeGroupLocalData(store, "g1");
    expect(report.remainingKeys).toEqual(["future-feature:g1"]);
  });

  it("rejects an empty id or one containing a colon", async () => {
    const { store } = await makeStore();
    await expect(purgeGroupLocalData(store, "")).rejects.toBeInstanceOf(InvalidGroupIdError);
    await expect(purgeGroupLocalData(store, "a:b")).rejects.toBeInstanceOf(InvalidGroupIdError);
  });
});
