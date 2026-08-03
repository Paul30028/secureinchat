import { describe, expect, it } from "vitest";
import {
  buildFileEnvelopes,
  FileAssembler,
  totalChunksFor,
  bytesToBase64Url,
  base64UrlToBytes,
  CHUNK_SIZE_BYTES,
} from "../src/fileTransfer";

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = i % 256;
  return bytes;
}

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes including 0xFF and 0x00", () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 128]);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("totalChunksFor", () => {
  it("treats an empty file as one chunk (avoids a zero-chunk edge case)", () => {
    expect(totalChunksFor(0)).toBe(1);
  });

  it("rounds up for partial chunks", () => {
    expect(totalChunksFor(CHUNK_SIZE_BYTES + 1)).toBe(2);
  });

  it("is exact for an exact multiple", () => {
    expect(totalChunksFor(CHUNK_SIZE_BYTES * 3)).toBe(3);
  });
});

describe("buildFileEnvelopes + FileAssembler", () => {
  it("round-trips a small single-chunk file", () => {
    const bytes = new TextEncoder().encode("hello world");
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f1",
      fileName: "note.txt",
      mimeType: "text/plain",
      mediaKind: "file",
      bytes,
    });
    expect(chunks).toHaveLength(1);

    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    const done = assembler.acceptChunk(chunks[0]!);
    expect(done).toBeDefined();
    expect(new TextDecoder().decode(done!.bytes)).toBe("hello world");
    expect(done!.fileName).toBe("note.txt");
  });

  it("round-trips a multi-chunk file byte-for-byte", () => {
    const bytes = randomBytes(CHUNK_SIZE_BYTES * 2 + 1234);
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f2",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      mediaKind: "image",
      bytes,
    });
    expect(chunks).toHaveLength(3);

    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    let done;
    for (const chunk of chunks) done = assembler.acceptChunk(chunk);
    expect(done).toBeDefined();
    expect(Array.from(done!.bytes)).toEqual(Array.from(bytes));
    expect(done!.mediaKind).toBe("image");
  });

  it("assembles correctly when chunks arrive out of order", () => {
    const bytes = randomBytes(CHUNK_SIZE_BYTES * 2 + 500);
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f3",
      fileName: "voice.webm",
      mimeType: "audio/webm",
      mediaKind: "voice",
      bytes,
    });

    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    const shuffled = [chunks[2]!, chunks[0]!, chunks[1]!];
    let done;
    for (const chunk of shuffled) done = assembler.acceptChunk(chunk);
    expect(done).toBeDefined();
    expect(Array.from(done!.bytes)).toEqual(Array.from(bytes));
  });

  it("returns undefined until every chunk has arrived", () => {
    const bytes = randomBytes(CHUNK_SIZE_BYTES * 2);
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f4",
      fileName: "x.bin",
      mimeType: "application/octet-stream",
      mediaKind: "file",
      bytes,
    });
    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    expect(assembler.acceptChunk(chunks[0]!)).toBeUndefined();
    expect(assembler.acceptChunk(chunks[1]!)).toBeDefined();
  });

  it("drops chunks that arrive before their meta (no file name / count known yet)", () => {
    const { chunks } = buildFileEnvelopes({
      fileId: "orphan",
      fileName: "x",
      mimeType: "text/plain",
      mediaKind: "file",
      bytes: new TextEncoder().encode("x"),
    });
    const assembler = new FileAssembler();
    expect(assembler.acceptChunk(chunks[0]!)).toBeUndefined();
  });

  it("a duplicate meta does not wipe already-received chunks", () => {
    const bytes = randomBytes(CHUNK_SIZE_BYTES * 2);
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f5",
      fileName: "x.bin",
      mimeType: "application/octet-stream",
      mediaKind: "file",
      bytes,
    });
    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    assembler.acceptChunk(chunks[0]!);
    assembler.acceptMeta(meta); // duplicate (e.g. sender retried)
    expect(assembler.acceptChunk(chunks[1]!)).toBeDefined();
  });

  it("reports in-progress transfers for UI display", () => {
    const bytes = randomBytes(CHUNK_SIZE_BYTES * 3);
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f6",
      fileName: "big.bin",
      mimeType: "application/octet-stream",
      mediaKind: "file",
      bytes,
    });
    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    assembler.acceptChunk(chunks[0]!);

    const progress = assembler.progress();
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ fileId: "f6", fileName: "big.bin", receivedChunks: 1, totalChunks: 3 });
  });

  it("clears the transfer from progress once complete", () => {
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f7",
      fileName: "x",
      mimeType: "text/plain",
      mediaKind: "file",
      bytes: new TextEncoder().encode("x"),
    });
    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    assembler.acceptChunk(chunks[0]!);
    expect(assembler.progress()).toHaveLength(0);
  });

  it("handles an empty file", () => {
    const { meta, chunks } = buildFileEnvelopes({
      fileId: "f8",
      fileName: "empty.txt",
      mimeType: "text/plain",
      mediaKind: "file",
      bytes: new Uint8Array(0),
    });
    const assembler = new FileAssembler();
    assembler.acceptMeta(meta);
    const done = assembler.acceptChunk(chunks[0]!);
    expect(done).toBeDefined();
    expect(done!.bytes.byteLength).toBe(0);
  });
});
