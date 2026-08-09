import { describe, expect, it, vi } from "vitest";
import {
  progressPercent,
  describeSendProgress,
  sendFileEnvelopes,
  type SendProgress,
} from "../src/sendProgress";

describe("progressPercent", () => {
  it("reports a rounded percentage", () => {
    expect(progressPercent({ sentChunks: 1, totalChunks: 3, fileName: "x" })).toBe(33);
    expect(progressPercent({ sentChunks: 3, totalChunks: 3, fileName: "x" })).toBe(100);
  });

  it("treats an empty transfer as complete rather than dividing by zero", () => {
    expect(progressPercent({ sentChunks: 0, totalChunks: 0, fileName: "x" })).toBe(100);
  });

  it("never exceeds 100", () => {
    expect(progressPercent({ sentChunks: 5, totalChunks: 3, fileName: "x" })).toBe(100);
  });
});

describe("describeSendProgress", () => {
  it("omits the percentage for single-chunk files, which finish instantly", () => {
    const p: SendProgress = { sentChunks: 0, totalChunks: 1, fileName: "note.txt" };
    expect(describeSendProgress(p)).toBe("正在发送 note.txt");
  });

  it("shows a percentage once there are several chunks", () => {
    const p: SendProgress = { sentChunks: 5, totalChunks: 10, fileName: "hymn.mp3" };
    expect(describeSendProgress(p)).toBe("正在发送 hymn.mp3（50%）");
  });
});

describe("sendFileEnvelopes", () => {
  it("sends the meta frame before any chunk", async () => {
    const order: string[] = [];
    const send = vi.fn(async (env: unknown) => {
      order.push((env as { kind: string }).kind);
    });
    await sendFileEnvelopes(
      { fileName: "a.mp3" },
      { kind: "file-meta" },
      [{ kind: "file-chunk" }, { kind: "file-chunk" }],
      send
    );
    expect(order).toEqual(["file-meta", "file-chunk", "file-chunk"]);
  });

  it("reports progress from zero up to every chunk sent", async () => {
    const seen: number[] = [];
    await sendFileEnvelopes({ fileName: "a.mp3" }, {}, [{}, {}, {}], async () => {}, {
      onProgress: (p) => seen.push(p.sentChunks),
    });
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it("carries the file name through so the UI can name what's sending", async () => {
    const names: string[] = [];
    await sendFileEnvelopes({ fileName: "奇异恩典.mp3" }, {}, [{}], async () => {}, {
      onProgress: (p) => names.push(p.fileName),
    });
    expect(new Set(names)).toEqual(new Set(["奇异恩典.mp3"]));
  });

  it("works without a progress callback", async () => {
    const send = vi.fn(async () => {});
    await sendFileEnvelopes({ fileName: "a" }, {}, [{}, {}], send);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("stops at the failing chunk instead of pretending the rest went out", async () => {
    let calls = 0;
    const send = vi.fn(async () => {
      calls++;
      if (calls === 3) throw new Error("connection lost");
    });
    const seen: number[] = [];

    await expect(
      sendFileEnvelopes({ fileName: "a" }, {}, [{}, {}, {}], send, {
        onProgress: (p) => seen.push(p.sentChunks),
      })
    ).rejects.toThrow("connection lost");

    // meta + 第一片成功，第二片失败——所以只报到 1
    expect(seen).toEqual([0, 1]);
  });
});
