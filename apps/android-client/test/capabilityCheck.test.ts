import "fake-indexeddb/auto";
import { describe, expect, it, afterEach } from "vitest";
import { checkCryptoStorage } from "../src/capabilityCheck";

const realIndexedDb = globalThis.indexedDB;
const realSubtle = globalThis.crypto.subtle;

afterEach(() => {
  Object.defineProperty(globalThis, "indexedDB", { value: realIndexedDb, configurable: true });
  Object.defineProperty(globalThis.crypto, "subtle", { value: realSubtle, configurable: true });
});

describe("checkCryptoStorage", () => {
  it("passes on a capable environment", async () => {
    expect(await checkCryptoStorage()).toEqual({ ok: true });
  });

  it("reports the HTTPS requirement when there's no crypto.subtle", async () => {
    Object.defineProperty(globalThis.crypto, "subtle", { value: undefined, configurable: true });
    const result = await checkCryptoStorage();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain("HTTPS");
  });

  it("reports missing IndexedDB rather than throwing", async () => {
    Object.defineProperty(globalThis, "indexedDB", { value: undefined, configurable: true });
    const result = await checkCryptoStorage();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("IndexedDB");
  });

  it("tells the user to update WebView when a CryptoKey can't be stored", async () => {
    // 复现老 Android WebView 的行为：结构化克隆不支持 CryptoKey，put 同步抛错
    const fakeDb = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({
        objectStore: () => ({
          put: () => {
            throw new DOMException("could not be cloned", "DataCloneError");
          },
        }),
      }),
      close: () => {},
    };
    Object.defineProperty(globalThis, "indexedDB", {
      value: {
        open: () => {
          const req = { result: fakeDb, onsuccess: null as null | (() => void), onerror: null, onupgradeneeded: null };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        },
        deleteDatabase: () => undefined,
      },
      configurable: true,
    });

    const result = await checkCryptoStorage();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("无法保存加密密钥");
      expect(result.detail).toContain("Android System WebView");
    }
  });
});
