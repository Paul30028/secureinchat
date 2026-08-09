import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import {
  validatePin,
  enableLock,
  disableLock,
  isLockEnabled,
  tryUnlock,
  MAX_ATTEMPTS,
  PIN_MIN_LENGTH,
} from "../src/appLock";

beforeEach(async () => {
  await disableLock();
});

describe("validatePin", () => {
  it("requires a minimum length", () => {
    expect(validatePin("123").ok).toBe(false);
    expect(validatePin("1".repeat(PIN_MIN_LENGTH - 1)).ok).toBe(false);
  });

  it("requires digits only — the keypad is numeric", () => {
    expect(validatePin("12ab").ok).toBe(false);
  });

  it("rejects an all-same-digit PIN", () => {
    expect(validatePin("0000").ok).toBe(false);
    expect(validatePin("999999").ok).toBe(false);
  });

  it("accepts a reasonable PIN", () => {
    expect(validatePin("2846")).toEqual({ ok: true });
  });
});

describe("app lock lifecycle", () => {
  it("is off until enabled", async () => {
    expect(await isLockEnabled()).toBe(false);
  });

  it("turns on and off", async () => {
    await enableLock("2846");
    expect(await isLockEnabled()).toBe(true);
    await disableLock();
    expect(await isLockEnabled()).toBe(false);
  });

  it("accepts the right PIN", async () => {
    await enableLock("2846");
    expect((await tryUnlock("2846")).ok).toBe(true);
  });

  it("rejects the wrong PIN", async () => {
    await enableLock("2846");
    expect((await tryUnlock("1357")).ok).toBe(false);
  });

  it("never stores the PIN itself", async () => {
    await enableLock("2846");
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();
    const raw = await backend.get("applock:v1");
    const text = new TextDecoder().decode(raw);
    expect(text).not.toContain("2846");
  });

  it("uses a fresh salt each time, so the same PIN doesn't produce the same stored value", async () => {
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();

    await enableLock("2846");
    const first = new TextDecoder().decode(await backend.get("applock:v1"));
    await disableLock();
    await enableLock("2846");
    const second = new TextDecoder().decode(await backend.get("applock:v1"));

    expect(first).not.toBe(second);
  });
});

describe("failed attempts", () => {
  it("counts down remaining attempts", async () => {
    await enableLock("2846");
    expect((await tryUnlock("0001")).attemptsLeft).toBe(MAX_ATTEMPTS - 1);
    expect((await tryUnlock("0002")).attemptsLeft).toBe(MAX_ATTEMPTS - 2);
  });

  it("resets the counter after a successful unlock", async () => {
    await enableLock("2846");
    await tryUnlock("0001");
    await tryUnlock("2846");
    expect((await tryUnlock("0001")).attemptsLeft).toBe(MAX_ATTEMPTS - 1);
  });

  it("reaches zero attempts left after the limit", async () => {
    await enableLock("2846");
    let result = { attemptsLeft: MAX_ATTEMPTS };
    for (let i = 0; i < MAX_ATTEMPTS; i++) result = await tryUnlock("0000");
    expect(result.attemptsLeft).toBe(0);
  });

  it("unlocks freely when no lock is set, rather than blocking the app", async () => {
    expect(await tryUnlock("anything")).toEqual({ ok: true, attemptsLeft: MAX_ATTEMPTS });
  });
});
