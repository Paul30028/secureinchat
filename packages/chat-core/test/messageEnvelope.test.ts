import { describe, expect, it } from "vitest";
import { decodeEnvelope, encodeEnvelope, EnvelopeDecodeError, type MessageEnvelope } from "../src/messageEnvelope";

describe("message envelope", () => {
  it("round-trips a text envelope", () => {
    const env: MessageEnvelope = { kind: "text", id: "m1", text: "你好", sentAtMs: 123 };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });

  it("round-trips an announcement envelope", () => {
    const env: MessageEnvelope = {
      kind: "announcement",
      id: "a1",
      title: "每日公告",
      body: "今天七点线上聚会",
      sentAtMs: 456,
    };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });

  it("round-trips a file-meta envelope including the file name (which the relay never sees)", () => {
    const env: MessageEnvelope = {
      kind: "file-meta",
      fileId: "f1",
      fileName: "今晚分享提纲.pdf",
      mimeType: "application/pdf",
      totalBytes: 1024,
      totalChunks: 1,
      mediaKind: "file",
      sentAtMs: 789,
    };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });

  it("round-trips a file-chunk envelope", () => {
    const env: MessageEnvelope = { kind: "file-chunk", fileId: "f1", chunkIndex: 3, dataB64Url: "aGVsbG8" };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });

  it("rejects non-JSON payloads", () => {
    expect(() => decodeEnvelope(new TextEncoder().encode("not json"))).toThrow(EnvelopeDecodeError);
  });

  it("rejects an unknown kind (forward-compat: a newer client sent something we don't know)", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ kind: "video-call-invite", foo: 1 }));
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError);
  });

  it("rejects a payload with no kind at all", () => {
    expect(() => decodeEnvelope(new TextEncoder().encode(JSON.stringify({ text: "hi" })))).toThrow(
      EnvelopeDecodeError
    );
  });
});
