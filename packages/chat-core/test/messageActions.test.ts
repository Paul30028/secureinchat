import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  searchMessages,
  buildReplyExcerpt,
  copyToClipboard,
  REPLY_EXCERPT_MAX,
  type SearchableMessage,
} from "../src/messageActions";

function msg(id: string, text: string, sentAtMs = Number(id)): SearchableMessage {
  return { id, text, sentAtMs };
}

describe("searchMessages", () => {
  const messages = [
    msg("1", "今晚七点线上聚会"),
    msg("2", "带上笔记本"),
    msg("3", "聚会改到八点了"),
  ];

  it("returns nothing for an empty query rather than everything", () => {
    expect(searchMessages(messages, "")).toEqual([]);
    expect(searchMessages(messages, "   ")).toEqual([]);
  });

  it("finds messages containing the keyword", () => {
    const hits = searchMessages(messages, "聚会");
    expect(hits.map((h) => h.message.id).sort()).toEqual(["1", "3"]);
  });

  it("returns newest hits first", () => {
    const hits = searchMessages(messages, "聚会");
    expect(hits[0]!.message.id).toBe("3");
  });

  it("is case-insensitive", () => {
    const hits = searchMessages([msg("1", "Meeting at SEVEN")], "meeting at seven");
    expect(hits).toHaveLength(1);
  });

  it("reports the match position so the UI can highlight it", () => {
    const hits = searchMessages([msg("1", "abcKEYdef")], "key");
    expect(hits[0]).toMatchObject({ matchStart: 3, matchLength: 3 });
  });

  it("searches file names for media messages", () => {
    const withFile: SearchableMessage = { id: "1", sentAtMs: 1, media: { fileName: "分享提纲.pdf" } };
    expect(searchMessages([withFile], "提纲")).toHaveLength(1);
  });

  it("finds nothing when the keyword is absent", () => {
    expect(searchMessages(messages, "不存在的词")).toEqual([]);
  });
});

describe("buildReplyExcerpt", () => {
  it("keeps short text as-is", () => {
    expect(buildReplyExcerpt(msg("1", "短消息"))).toBe("短消息");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "字".repeat(REPLY_EXCERPT_MAX + 20);
    const excerpt = buildReplyExcerpt(msg("1", long));
    expect(excerpt).toHaveLength(REPLY_EXCERPT_MAX + 1); // +1 是省略号
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("describes media by filename", () => {
    const media: SearchableMessage = { id: "1", sentAtMs: 1, media: { fileName: "photo.jpg" } };
    expect(buildReplyExcerpt(media)).toBe("[文件] photo.jpg");
  });

  it("handles a message with neither text nor media", () => {
    expect(buildReplyExcerpt({ id: "1", sentAtMs: 1 })).toBe("");
  });
});

describe("copyToClipboard", () => {
  beforeEach(() => {
    // Node 21 以下没有全局 navigator（CI 跑的就是 Node 20），
    // 所以不能假设它存在——需要时自己建一个。
    if (typeof globalThis.navigator === "undefined") {
      Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    }
    Object.assign(globalThis.navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("returns true on success", async () => {
    expect(await copyToClipboard("hello")).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false rather than throwing when there is no global navigator at all", async () => {
    // CI 跑的 Node 20 就是这种情况——navigator 是 Node 21 才加的全局。
    // 直接访问会抛 ReferenceError，catch 都接不住。
    const saved = globalThis.navigator;
    // @ts-expect-error deliberately removing the global
    delete globalThis.navigator;
    try {
      expect(await copyToClipboard("x")).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "navigator", { value: saved, configurable: true, writable: true });
    }
  });

  it("returns false when there is no clipboard API at all (old WebView / insecure context)", async () => {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    expect(await copyToClipboard("hello")).toBe(false);
  });

  it("returns false instead of throwing when the clipboard write is rejected", async () => {
    Object.assign(globalThis.navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await copyToClipboard("hello")).toBe(false);
  });
});
