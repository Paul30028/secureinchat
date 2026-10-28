import { describe, expect, it } from "vitest";
import {
  loadMessages,
  saveMessages,
  base64UrlToBytes,
  MAX_PERSISTED_MEDIA_BYTES,
  MAX_STORED_MESSAGES_PER_GROUP,
  type StoredMessage,
} from "@secureinchat/chat-core";
import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";
import { PersistedMediaCache, SerialSaver } from "../src/mediaPersistence";
import { toStored } from "../src/messageMapping";
import type { DisplayMessage } from "../src/screens/ChatScreen";

/**
 * C8：任何一次整体落盘都不能丢掉已经存过的媒体内容；
 * 删除和到期删除的消息，其媒体内容必须真的从存储里消失。
 *
 * 用一个内存里的假存储代替 EncryptedKeyValueStore（只用到 get/set/delete），
 * 直接测落盘组装逻辑，不走整个 App。
 */

/** 内存假存储；setDelays 让指定次数的 set 变慢，用来制造乱序完成。 */
function fakeStore(setDelays: number[] = []) {
  const data = new Map<string, Uint8Array>();
  let call = 0;
  const store = {
    async get(key: string) {
      return data.get(key);
    },
    async set(key: string, value: Uint8Array) {
      const delay = setDelays[call++] ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      data.set(key, value);
    },
    async delete(key: string) {
      data.delete(key);
    },
  };
  return { store: store as unknown as EncryptedKeyValueStore, data };
}

const G = "group-1";

function image(id: string, sizeBytes: number): DisplayMessage {
  return {
    id,
    isOwn: false,
    fromDeviceId: "peer",
    sentAtMs: 1_000,
    media: { mediaKind: "image", fileName: `${id}.jpg`, mimeType: "image/jpeg", objectUrl: "blob:x", sizeBytes },
  };
}

function text(id: string, body: string): DisplayMessage {
  return { id, isOwn: false, fromDeviceId: "peer", sentAtMs: 2_000, text: body };
}

const PIXELS = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);

/** App 里 saveGroupMessages 的同款：同步组装，再排队写入。 */
function saver(store: EncryptedKeyValueStore) {
  const cache = new PersistedMediaCache();
  const serial = new SerialSaver();
  const save = (messages: DisplayMessage[], newBytes?: Map<string, Uint8Array>) => {
    const list = cache.buildStored(G, messages, newBytes);
    return serial.enqueue(G, () => saveMessages(store, G, list));
  };
  return { cache, serial, save };
}

function mediaOf(list: StoredMessage[], id: string) {
  return list.find((m) => m.id === id)?.media;
}

describe("C8 媒体内容落盘", () => {
  it("修复前的写法会丢：只在新到那一次带字节的 toStored，下一次保存就把图片内容写成 undefined", async () => {
    const { store } = fakeStore();
    const img = image("img-1", PIXELS.length);
    await saveMessages(store, G, [toStored(img, PIXELS)]);
    await saveMessages(store, G, [img, text("t-1", "hi")].map((m) => toStored(m)));
    const loaded = await loadMessages(store, G);
    expect(mediaOf(loaded, "img-1")?.dataB64Url).toBeUndefined();
  });

  it("收到图片 → 再收一条文本 → 重新加载，图片内容仍在且字节不变", async () => {
    const { store } = fakeStore();
    const { save } = saver(store);
    const img = image("img-1", PIXELS.length);
    await save([img], new Map([["img-1", PIXELS]]));
    await save([img, text("t-1", "hi")]);

    const loaded = await loadMessages(store, G);
    const b64 = mediaOf(loaded, "img-1")?.dataB64Url;
    expect(b64).toBeDefined();
    expect(Array.from(base64UrlToBytes(b64!))).toEqual(Array.from(PIXELS));
    expect(loaded.map((m) => m.id)).toEqual(["img-1", "t-1"]);
  });

  it("重启后（seed）再保存，之前存过的内容仍在", async () => {
    const { store } = fakeStore();
    const first = saver(store);
    const img = image("img-1", PIXELS.length);
    await first.save([img], new Map([["img-1", PIXELS]]));

    // 模拟重启：新的缓存，只能从存储里加载
    const after = saver(store);
    const history = await loadMessages(store, G);
    after.cache.seed(G, history);
    await after.save([img, text("t-2", "after restart")]);

    const loaded = await loadMessages(store, G);
    expect(mediaOf(loaded, "img-1")?.dataB64Url).toBeDefined();
  });

  it("删除那张图 → 重新加载，内容不在存储里，缓存里也没有", async () => {
    const { store, data } = fakeStore();
    const { cache, save } = saver(store);
    const img = image("img-1", PIXELS.length);
    const t = text("t-1", "hi");
    await save([img, t], new Map([["img-1", PIXELS]]));
    expect(cache.sizeOf(G)).toBe(1);

    await save([t]); // 删除 / 到期：列表里没有它了
    const loaded = await loadMessages(store, G);
    expect(loaded.map((m) => m.id)).toEqual(["t-1"]);
    expect(cache.sizeOf(G)).toBe(0);
    // 原始存储字节里也找不到那段 base64
    const raw = new TextDecoder().decode(data.get(`messages:${G}`)!);
    expect(raw).not.toContain("dataB64Url");
  });

  it("超过 MAX_PERSISTED_MEDIA_BYTES 的媒体只留元信息，之后的保存也不会凭空补上", async () => {
    const { store } = fakeStore();
    const { cache, save } = saver(store);
    const big = image("big", MAX_PERSISTED_MEDIA_BYTES + 1);
    await save([big], new Map([["big", PIXELS]]));
    await save([big, text("t", "x")]);
    const loaded = await loadMessages(store, G);
    expect(mediaOf(loaded, "big")?.fileName).toBe("big.jpg");
    expect(mediaOf(loaded, "big")?.dataB64Url).toBeUndefined();
    expect(cache.sizeOf(G)).toBe(0);
  });

  it("被条数上限挤掉的消息，内容从缓存里放掉（内存有界）", async () => {
    const { store } = fakeStore();
    const { cache, save } = saver(store);
    const img = image("img-old", PIXELS.length);
    await save([img], new Map([["img-old", PIXELS]]));
    const many = [img];
    for (let i = 0; i < MAX_STORED_MESSAGES_PER_GROUP; i++) many.push(text(`t-${i}`, "x"));
    await save(many);
    const loaded = await loadMessages(store, G);
    expect(loaded).toHaveLength(MAX_STORED_MESSAGES_PER_GROUP);
    expect(mediaOf(loaded, "img-old")).toBeUndefined();
    expect(cache.sizeOf(G)).toBe(0);
  });

  it("forget 后整组缓存清空", async () => {
    const { store } = fakeStore();
    const { cache, save } = saver(store);
    await save([image("img-1", PIXELS.length)], new Map([["img-1", PIXELS]]));
    cache.forget(G);
    expect(cache.sizeOf(G)).toBe(0);
  });
});

describe("C8 写入排队（竞态）", () => {
  it("第一次写入慢、第二次快：最后留下的是后调用的那次（删掉的图不会复活）", async () => {
    // 第 1 次 set 延迟 30 ms，第 2 次立即完成。不排队时第 1 次会后完成，覆盖第 2 次。
    const { store } = fakeStore([30, 0]);
    const { save } = saver(store);
    const img = image("img-1", PIXELS.length);
    const t = text("t-1", "hi");
    const p1 = save([img, t], new Map([["img-1", PIXELS]]));
    const p2 = save([t]); // 紧接着删除了图片
    await Promise.all([p1, p2]);
    const loaded = await loadMessages(store, G);
    expect(loaded.map((m) => m.id)).toEqual(["t-1"]);
  });

  it("不排队时确实会乱序（证明上面的测试能抓到问题）", async () => {
    const { store } = fakeStore([30, 0]);
    const cache = new PersistedMediaCache();
    const img = image("img-1", PIXELS.length);
    const t = text("t-1", "hi");
    const p1 = saveMessages(store, G, cache.buildStored(G, [img, t], new Map([["img-1", PIXELS]])));
    const p2 = saveMessages(store, G, cache.buildStored(G, [t]));
    await Promise.all([p1, p2]);
    const loaded = await loadMessages(store, G);
    expect(loaded.map((m) => m.id)).toEqual(["img-1", "t-1"]);
  });

  it("前一次写入失败不挡住后一次", async () => {
    const serial = new SerialSaver();
    const order: string[] = [];
    const p1 = serial.enqueue(G, async () => {
      order.push("a");
      throw new Error("disk");
    });
    const p2 = serial.enqueue(G, async () => {
      order.push("b");
    });
    await expect(p1).rejects.toThrow("disk");
    await p2;
    expect(order).toEqual(["a", "b"]);
  });

  it("不同群互不排队", async () => {
    const serial = new SerialSaver();
    const order: string[] = [];
    const slow = serial.enqueue("A", () => new Promise<void>((r) => setTimeout(() => { order.push("A"); r(); }, 20)));
    const fast = serial.enqueue("B", async () => { order.push("B"); });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["B", "A"]);
  });
});
