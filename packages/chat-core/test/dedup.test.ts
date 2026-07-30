import { describe, expect, it } from "vitest";
import { MessageDeduplicator } from "../src/dedup";

describe("MessageDeduplicator", () => {
  it("processes a message the first time and dedups subsequent deliveries", () => {
    const dedup = new MessageDeduplicator();
    expect(dedup.shouldProcess("msg-1")).toBe(true);
    expect(dedup.shouldProcess("msg-1")).toBe(false);
    expect(dedup.shouldProcess("msg-1")).toBe(false);
  });

  it("treats different ids independently", () => {
    const dedup = new MessageDeduplicator();
    expect(dedup.shouldProcess("a")).toBe(true);
    expect(dedup.shouldProcess("b")).toBe(true);
    expect(dedup.shouldProcess("a")).toBe(false);
  });

  it("evicts the oldest entry once maxTracked is exceeded", () => {
    const dedup = new MessageDeduplicator(3);
    dedup.shouldProcess("1");
    dedup.shouldProcess("2");
    dedup.shouldProcess("3");
    expect(dedup.trackedCount).toBe(3);
    dedup.shouldProcess("4"); // should evict "1"
    expect(dedup.trackedCount).toBe(3);
    // "1" was evicted, so it's treated as new again
    expect(dedup.shouldProcess("1")).toBe(true);
  });
});
