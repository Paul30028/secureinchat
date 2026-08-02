import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbStorageBackend } from "../src/indexedDbStorageBackend";

describe("IndexedDbStorageBackend", () => {
  it("round-trips a value", async () => {
    const backend = new IndexedDbStorageBackend();
    await backend.set("k", new TextEncoder().encode("hello"));
    const value = await backend.get("k");
    expect(new TextDecoder().decode(value)).toBe("hello");
  });

  it("returns undefined for a key never set", async () => {
    const backend = new IndexedDbStorageBackend();
    expect(await backend.get("nope")).toBeUndefined();
  });

  it("delete removes the value", async () => {
    const backend = new IndexedDbStorageBackend();
    await backend.set("k", new TextEncoder().encode("v"));
    await backend.delete("k");
    expect(await backend.get("k")).toBeUndefined();
  });

  it("listKeys respects the prefix filter", async () => {
    const backend = new IndexedDbStorageBackend();
    await backend.set("group:1:key", new TextEncoder().encode("a"));
    await backend.set("group:2:key", new TextEncoder().encode("b"));
    await backend.set("device:identity", new TextEncoder().encode("c"));
    const keys = await backend.listKeys("group:");
    expect(keys.sort()).toEqual(["group:1:key", "group:2:key"]);
  });

  it("survives being re-opened as a fresh instance (simulates a page reload)", async () => {
    const first = new IndexedDbStorageBackend();
    await first.set("persisted", new TextEncoder().encode("still here"));

    // A brand new instance, sharing nothing with `first` except the same
    // IndexedDB database name — this is exactly what happens on page reload:
    // a new JS heap, same underlying browser storage.
    const second = new IndexedDbStorageBackend();
    const value = await second.get("persisted");
    expect(new TextDecoder().decode(value)).toBe("still here");
  });
});
