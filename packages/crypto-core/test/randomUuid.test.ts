import { describe, expect, it, afterEach } from "vitest";
import { randomUUID } from "../src/randomUuid";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realRandomUUID = globalThis.crypto.randomUUID;

afterEach(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: realRandomUUID,
    configurable: true,
  });
});

describe("randomUUID", () => {
  it("returns a valid v4 UUID when the native API exists", () => {
    expect(randomUUID()).toMatch(UUID_V4_RE);
  });

  it("falls back to getRandomValues when crypto.randomUUID is missing (older Android WebView)", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    expect(randomUUID()).toMatch(UUID_V4_RE);
  });

  it("the fallback sets the version and variant bits correctly", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    for (let i = 0; i < 50; i++) {
      const uuid = randomUUID();
      expect(uuid[14]).toBe("4"); // version nibble
      expect(["8", "9", "a", "b"]).toContain(uuid[19]); // variant nibble
    }
  });

  it("the fallback produces distinct values", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(randomUUID());
    expect(seen.size).toBe(500);
  });

  it("throws a clear error when there is no CSPRNG at all", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    const realGet = globalThis.crypto.getRandomValues;
    Object.defineProperty(globalThis.crypto, "getRandomValues", { value: undefined, configurable: true });
    try {
      expect(() => randomUUID()).toThrow(/getRandomValues/);
    } finally {
      Object.defineProperty(globalThis.crypto, "getRandomValues", { value: realGet, configurable: true });
    }
  });
});
