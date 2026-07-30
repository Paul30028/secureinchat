import { describe, expect, it, vi } from "vitest";
import { computeBackoffMs, OfflineOutbox } from "../src/offlineOutbox";

describe("computeBackoffMs", () => {
  it("is zero for attempt 0", () => {
    expect(computeBackoffMs(0)).toBe(0);
  });

  it("doubles per attempt up to the cap", () => {
    expect(computeBackoffMs(1)).toBe(1000);
    expect(computeBackoffMs(2)).toBe(2000);
    expect(computeBackoffMs(3)).toBe(4000);
  });

  it("never exceeds the cap", () => {
    expect(computeBackoffMs(20)).toBe(30_000);
  });
});

describe("OfflineOutbox", () => {
  it("enqueues and successfully flushes a pending message", async () => {
    const outbox = new OfflineOutbox<string>();
    outbox.enqueue("m1", "hello");
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const result = await outbox.flush(sendFn);
    expect(result.sent).toEqual(["m1"]);
    expect(outbox.get("m1")?.status).toBe("sent");
  });

  it("does not enqueue the same id twice", () => {
    const outbox = new OfflineOutbox<string>();
    outbox.enqueue("m1", "a");
    outbox.enqueue("m1", "b"); // ignored — id already queued
    expect(outbox.listByStatus("pending")).toHaveLength(1);
    expect(outbox.get("m1")?.payload).toBe("a");
  });

  it("keeps a message pending (for retry) after a failed send below maxAttempts", async () => {
    const outbox = new OfflineOutbox<string>(5);
    outbox.enqueue("m1", "hello");
    const sendFn = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await outbox.flush(sendFn);
    expect(result.stillPending).toEqual(["m1"]);
    expect(outbox.get("m1")?.status).toBe("pending");
    expect(outbox.get("m1")?.attempts).toBe(1);
  });

  it("marks a message failed after exceeding maxAttempts", async () => {
    const outbox = new OfflineOutbox<string>(2);
    outbox.enqueue("m1", "hello");
    const sendFn = vi.fn().mockRejectedValue(new Error("network down"));
    await outbox.flush(sendFn);
    const result = await outbox.flush(sendFn);
    expect(result.failed).toEqual(["m1"]);
    expect(outbox.get("m1")?.status).toBe("failed");
  });

  it("retry() resets a failed message back to pending with attempts cleared", async () => {
    const outbox = new OfflineOutbox<string>(1);
    outbox.enqueue("m1", "hello");
    await outbox.flush(vi.fn().mockRejectedValue(new Error("fail")));
    expect(outbox.get("m1")?.status).toBe("failed");

    outbox.retry("m1");
    expect(outbox.get("m1")?.status).toBe("pending");
    expect(outbox.get("m1")?.attempts).toBe(0);

    const result = await outbox.flush(vi.fn().mockResolvedValue(undefined));
    expect(result.sent).toEqual(["m1"]);
  });

  it("retry() throws for an unknown id", () => {
    const outbox = new OfflineOutbox<string>();
    expect(() => outbox.retry("nope")).toThrow();
  });

  it("processes independent messages independently on a mixed flush", async () => {
    const outbox = new OfflineOutbox<string>(1);
    outbox.enqueue("ok", "will succeed");
    outbox.enqueue("bad", "will fail");
    const sendFn = vi.fn(async (payload: string) => {
      if (payload === "will fail") throw new Error("boom");
    });
    const result = await outbox.flush(sendFn);
    expect(result.sent).toEqual(["ok"]);
    expect(result.failed).toEqual(["bad"]);
  });
});
