import { describe, expect, it } from "vitest";
import { generateAeadKey } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import {
  loadMessages,
  saveMessages,
  clearMessages,
  trimToLimit,
  shouldPersistMediaBytes,
  storageKeyForGroupMessages,
  MAX_STORED_MESSAGES_PER_GROUP,
  MAX_PERSISTED_MEDIA_BYTES,
  type StoredMessage,
} from "../src/messageStore";

async function makeStore() {
  const backend = new TestOnlyInMemoryStorageBackend();
  const key = await generateAeadKey();
  return { backend, store: new EncryptedKeyValueStore(backend, key) };
}

function msg(id: string, text: string): StoredMessage {
  return { id, isOwn: false, text, sentAtMs: Number(id) };
}

describe("trimToLimit", () => {
  it("leaves a short list untouched", () => {
    const list = [msg("1", "a"), msg("2", "b")];
    expect(trimToLimit(list, 10)).toEqual(list);
  });

  it("keeps the most recent entries, dropping the oldest", () => {
    const list = [msg("1", "a"), msg("2", "b"), msg("3", "c")];
    expect(trimToLimit(list, 2).map((m) => m.text)).toEqual(["b", "c"]);
  });

  it("defaults to the documented per-group cap", () => {
    const many = Array.from({ length: MAX_STORED_MESSAGES_PER_GROUP + 50 }, (_, i) => msg(String(i), `m${i}`));
    expect(trimToLimit(many)).toHaveLength(MAX_STORED_MESSAGES_PER_GROUP);
  });
});

describe("shouldPersistMediaBytes", () => {
  it("persists small media", () => {
    expect(shouldPersistMediaBytes(1024)).toBe(true);
  });

  it("skips media above the cap so local storage can't be blown up by a few photos", () => {
    expect(shouldPersistMediaBytes(MAX_PERSISTED_MEDIA_BYTES + 1)).toBe(false);
  });
});

describe("message persistence", () => {
  it("returns an empty list when nothing has been saved", async () => {
    const { store } = await makeStore();
    expect(await loadMessages(store, "group-1")).toEqual([]);
  });

  it("round-trips messages", async () => {
    const { store } = await makeStore();
    const messages = [msg("1", "第一条"), msg("2", "第二条")];
    await saveMessages(store, "group-1", messages);
    expect(await loadMessages(store, "group-1")).toEqual(messages);
  });

  it("keeps groups separate", async () => {
    const { store } = await makeStore();
    await saveMessages(store, "group-1", [msg("1", "群一的消息")]);
    await saveMessages(store, "group-2", [msg("2", "群二的消息")]);

    expect((await loadMessages(store, "group-1"))[0]?.text).toBe("群一的消息");
    expect((await loadMessages(store, "group-2"))[0]?.text).toBe("群二的消息");
  });

  it("stores ciphertext, not readable message text", async () => {
    const { store, backend } = await makeStore();
    await saveMessages(store, "group-1", [msg("1", "这是机密内容")]);

    const raw = await backend.get(storageKeyForGroupMessages("group-1"));
    const asText = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    expect(asText).not.toContain("这是机密内容");
  });

  it("applies the cap on save, not just in memory", async () => {
    const { store } = await makeStore();
    const many = Array.from({ length: MAX_STORED_MESSAGES_PER_GROUP + 20 }, (_, i) => msg(String(i), `m${i}`));
    await saveMessages(store, "group-1", many);
    expect(await loadMessages(store, "group-1")).toHaveLength(MAX_STORED_MESSAGES_PER_GROUP);
  });

  it("round-trips a media message with its bytes", async () => {
    const { store } = await makeStore();
    const withMedia: StoredMessage = {
      id: "m1",
      isOwn: true,
      sentAtMs: 1,
      media: {
        mediaKind: "image",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        dataB64Url: "aGVsbG8",
        sizeBytes: 5,
      },
    };
    await saveMessages(store, "group-1", [withMedia]);
    expect((await loadMessages(store, "group-1"))[0]).toEqual(withMedia);
  });

  it("clearing removes the history", async () => {
    const { store } = await makeStore();
    await saveMessages(store, "group-1", [msg("1", "x")]);
    await clearMessages(store, "group-1");
    expect(await loadMessages(store, "group-1")).toEqual([]);
  });

  it("returns an empty list rather than throwing when the stored data can't be decrypted", async () => {
    // 换了设备主密钥的情况：用另一把密钥写进去，再用原来的 store 读
    const { store, backend } = await makeStore();
    const otherKey = await generateAeadKey();
    const otherStore = new EncryptedKeyValueStore(backend, otherKey);
    await saveMessages(otherStore, "group-1", [msg("1", "别人的密文")]);

    expect(await loadMessages(store, "group-1")).toEqual([]);
  });
});
