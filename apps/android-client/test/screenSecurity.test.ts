import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  isScreenSecurityEnabled,
  setScreenSecurityEnabled,
  applyScreenSecurity,
} from "../src/screenSecurity";

const PREF_KEY = "screensecurity:v1";

describe("screen security preference", () => {
  it("is off by default", async () => {
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();
    await backend.delete(PREF_KEY);
    expect(await isScreenSecurityEnabled()).toBe(false);
  });

  it("reads back what was written", async () => {
    await setScreenSecurityEnabled(true);
    expect(await isScreenSecurityEnabled()).toBe(true);
    await setScreenSecurityEnabled(false);
    expect(await isScreenSecurityEnabled()).toBe(false);
  });

  it("treats bad JSON as false", async () => {
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();
    await backend.set(PREF_KEY, new TextEncoder().encode("not json at all"));
    expect(await isScreenSecurityEnabled()).toBe(false);
  });
});

describe("applyScreenSecurity", () => {
  it("returns false on non-native platforms and does not throw", async () => {
    await expect(applyScreenSecurity(true)).resolves.toBe(false);
  });
});
