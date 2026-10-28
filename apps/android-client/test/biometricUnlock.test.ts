import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  biometricAvailable,
  authenticateBiometric,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from "../src/biometricUnlock";
import { disableLock } from "../src/appLock";

const PREF_KEY = "biometricunlock:v1";

describe("非原生平台上的生物识别", () => {
  it("biometricAvailable 返回 false", async () => {
    expect(await biometricAvailable()).toBe(false);
  });

  it("authenticateBiometric 返回 false 且不抛", async () => {
    await expect(authenticateBiometric()).resolves.toBe(false);
  });
});

describe("生物识别解锁偏好", () => {
  it("默认关闭", async () => {
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();
    await backend.delete(PREF_KEY);
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });

  it("写入后能读回", async () => {
    await setBiometricUnlockEnabled(true);
    expect(await isBiometricUnlockEnabled()).toBe(true);
    await setBiometricUnlockEnabled(false);
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });

  it("坏 JSON 当 false", async () => {
    const { IndexedDbStorageBackend } = await import("@secureinchat/secure-storage");
    const backend = new IndexedDbStorageBackend();
    await backend.set(PREF_KEY, new TextEncoder().encode("not json at all"));
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });

  it("disableLock 之后偏好变 false", async () => {
    await setBiometricUnlockEnabled(true);
    expect(await isBiometricUnlockEnabled()).toBe(true);
    await disableLock();
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });
});
