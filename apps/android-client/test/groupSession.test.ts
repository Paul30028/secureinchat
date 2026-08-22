import { describe, expect, it } from "vitest";
import { unreadFor, previewFor, sortSessions, patchSession, type GroupSession } from "../src/groupSession";

function session(id: string, messages: GroupSession["messages"] = [], lastReadAtMs = 0): GroupSession {
  return {
    groupId: id,
    groupName: id,
    client: {} as GroupSession["client"],
    messages,
    connectionStatus: "connected",
    pendingCount: 0,
    onlinePeers: [],
    lastReadAtMs,
  };
}

describe("unreadFor", () => {
  it("counts incoming messages newer than the read marker", () => {
    const s = session("g", [
      { id: "1", isOwn: false, sentAtMs: 500, text: "old" },
      { id: "2", isOwn: false, sentAtMs: 1500, text: "new" },
      { id: "3", isOwn: false, sentAtMs: 1600, text: "newer" },
    ], 1000);
    expect(unreadFor(s)).toBe(2);
  });

  it("never counts your own messages", () => {
    const s = session("g", [{ id: "1", isOwn: true, sentAtMs: 2000, text: "mine" }], 1000);
    expect(unreadFor(s)).toBe(0);
  });

  it("is zero for an empty group", () => {
    expect(unreadFor(session("g"))).toBe(0);
  });
});

describe("previewFor", () => {
  it("returns undefined when there are no messages", () => {
    expect(previewFor(session("g"))).toBeUndefined();
  });

  it("uses the last message's text", () => {
    const s = session("g", [
      { id: "1", isOwn: false, sentAtMs: 1, text: "第一条" },
      { id: "2", isOwn: false, sentAtMs: 2, text: "最后一条" },
    ]);
    expect(previewFor(s)).toEqual({ preview: "最后一条", sentAtMs: 2 });
  });

  it("labels media messages by kind and filename rather than showing blank", () => {
    const s = session("g", [
      {
        id: "1",
        isOwn: false,
        sentAtMs: 5,
        media: { mediaKind: "image", fileName: "photo.jpg", mimeType: "image/jpeg", objectUrl: "", sizeBytes: 1 },
      },
    ]);
    expect(previewFor(s)?.preview).toBe("[图片] photo.jpg");
  });

  it("labels voice and file distinctly", () => {
    const voice = session("g", [
      {
        id: "1",
        isOwn: false,
        sentAtMs: 5,
        media: { mediaKind: "voice", fileName: "v.webm", mimeType: "audio/webm", objectUrl: "", sizeBytes: 1 },
      },
    ]);
    const file = session("g", [
      {
        id: "1",
        isOwn: false,
        sentAtMs: 5,
        media: { mediaKind: "file", fileName: "a.pdf", mimeType: "application/pdf", objectUrl: "", sizeBytes: 1 },
      },
    ]);
    expect(previewFor(voice)?.preview).toBe("[语音] v.webm");
    expect(previewFor(file)?.preview).toBe("[文件] a.pdf");
  });
});

describe("sortSessions", () => {
  it("puts the most recently active group first", () => {
    const sessions = {
      old: session("old", [{ id: "1", isOwn: false, sentAtMs: 100, text: "x" }]),
      recent: session("recent", [{ id: "2", isOwn: false, sentAtMs: 9000, text: "y" }]),
    };
    expect(sortSessions(sessions).map((s) => s.groupId)).toEqual(["recent", "old"]);
  });

  it("puts groups with no messages last", () => {
    const sessions = {
      empty: session("empty"),
      active: session("active", [{ id: "1", isOwn: false, sentAtMs: 5, text: "x" }]),
    };
    expect(sortSessions(sessions).map((s) => s.groupId)).toEqual(["active", "empty"]);
  });
});

describe("patchSession", () => {
  it("updates only the named session", () => {
    const sessions = { a: session("a"), b: session("b") };
    const result = patchSession(sessions, "a", { pendingCount: 5 });
    expect(result.a!.pendingCount).toBe(5);
    expect(result.b!.pendingCount).toBe(0);
  });

  it("is a no-op for an unknown group (e.g. a late callback after leaving)", () => {
    const sessions = { a: session("a") };
    expect(patchSession(sessions, "gone", { pendingCount: 5 })).toBe(sessions);
  });
});
