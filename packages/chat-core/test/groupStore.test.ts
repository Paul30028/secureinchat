import { describe, expect, it } from "vitest";
import { generateAeadKey } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import {
  loadJoinedGroups,
  saveJoinedGroups,
  upsertGroup,
  removeGroup,
  markGroupRead,
  unreadCount,
  type JoinedGroup,
} from "../src/groupStore";

async function makeStore() {
  const backend = new TestOnlyInMemoryStorageBackend();
  const key = await generateAeadKey();
  return { backend, store: new EncryptedKeyValueStore(backend, key) };
}

function group(id: string, name = id): JoinedGroup {
  return {
    groupId: id,
    groupName: name,
    keyMaterialB64Url: "km",
    epoch: 0,
    joinedAtMs: 1000,
    lastReadAtMs: 1000,
  };
}

describe("joined groups persistence", () => {
  it("starts empty", async () => {
    const { store } = await makeStore();
    expect(await loadJoinedGroups(store)).toEqual([]);
  });

  it("round-trips groups", async () => {
    const { store } = await makeStore();
    const groups = [group("g1", "读书会"), group("g2", "爬山队")];
    await saveJoinedGroups(store, groups);
    expect(await loadJoinedGroups(store)).toEqual(groups);
  });

  it("stores ciphertext — the key material must not be readable on disk", async () => {
    const { store, backend } = await makeStore();
    await saveJoinedGroups(store, [{ ...group("g1"), keyMaterialB64Url: "SECRET-KEY-MATERIAL" }]);

    const keys = await backend.listKeys();
    for (const k of keys) {
      const raw = await backend.get(k);
      const asText = new TextDecoder("utf-8", { fatal: false }).decode(raw);
      expect(asText).not.toContain("SECRET-KEY-MATERIAL");
    }
  });

  it("returns an empty list rather than throwing when the data can't be decrypted", async () => {
    const { store, backend } = await makeStore();
    const otherStore = new EncryptedKeyValueStore(backend, await generateAeadKey());
    await saveJoinedGroups(otherStore, [group("g1")]);

    expect(await loadJoinedGroups(store)).toEqual([]);
  });
});

describe("upsertGroup", () => {
  it("adds a new group", () => {
    expect(upsertGroup([], group("g1")).map((g) => g.groupId)).toEqual(["g1"]);
  });

  it("does not duplicate when rejoining the same group", () => {
    const existing = [group("g1", "旧名字")];
    const result = upsertGroup(existing, { ...group("g1", "新名字"), joinedAtMs: 9999 });
    expect(result).toHaveLength(1);
    expect(result[0]!.groupName).toBe("新名字");
  });

  it("keeps the original join time and read marker when rejoining", () => {
    const existing = [{ ...group("g1"), joinedAtMs: 1000, lastReadAtMs: 5000 }];
    const result = upsertGroup(existing, { ...group("g1"), joinedAtMs: 9999, lastReadAtMs: 0 });
    expect(result[0]!.joinedAtMs).toBe(1000);
    expect(result[0]!.lastReadAtMs).toBe(5000);
  });

  it("leaves other groups untouched", () => {
    const existing = [group("g1"), group("g2")];
    const result = upsertGroup(existing, group("g1", "改名了"));
    expect(result.find((g) => g.groupId === "g2")).toEqual(group("g2"));
  });
});

describe("removeGroup", () => {
  it("removes only the named group", () => {
    expect(removeGroup([group("g1"), group("g2")], "g1").map((g) => g.groupId)).toEqual(["g2"]);
  });

  it("is a no-op for an unknown group", () => {
    expect(removeGroup([group("g1")], "nope")).toHaveLength(1);
  });
});

describe("markGroupRead", () => {
  it("updates only the named group's read marker", () => {
    const result = markGroupRead([group("g1"), group("g2")], "g1", 7777);
    expect(result.find((g) => g.groupId === "g1")!.lastReadAtMs).toBe(7777);
    expect(result.find((g) => g.groupId === "g2")!.lastReadAtMs).toBe(1000);
  });
});

describe("unreadCount", () => {
  it("counts only incoming messages newer than the read marker", () => {
    const messages = [
      { sentAtMs: 500, isOwn: false },
      { sentAtMs: 1500, isOwn: false },
      { sentAtMs: 2000, isOwn: false },
    ];
    expect(unreadCount(messages, 1000)).toBe(2);
  });

  it("never counts your own messages as unread", () => {
    const messages = [
      { sentAtMs: 1500, isOwn: true },
      { sentAtMs: 1600, isOwn: true },
    ];
    expect(unreadCount(messages, 1000)).toBe(0);
  });

  it("is zero when everything has been read", () => {
    expect(unreadCount([{ sentAtMs: 500, isOwn: false }], 1000)).toBe(0);
  });
});
