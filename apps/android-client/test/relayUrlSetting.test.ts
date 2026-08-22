import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import {
  validateRelayUrl,
  saveRelayUrl,
  loadSavedRelayUrl,
  clearSavedRelayUrl,
} from "../src/relayUrlSetting";

describe("validateRelayUrl", () => {
  it("accepts a wss:// address", () => {
    expect(validateRelayUrl("wss://ws.example.com", true)).toEqual({ ok: true });
  });

  it("accepts ws:// on an insecure (http) page", () => {
    expect(validateRelayUrl("ws://192.168.1.5:8765", false)).toEqual({ ok: true });
  });

  it("rejects an empty address", () => {
    const result = validateRelayUrl("   ", false);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed address", () => {
    const result = validateRelayUrl("not a url", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("格式");
  });

  it("rejects http:// and https:// — this is a WebSocket endpoint", () => {
    expect(validateRelayUrl("https://ws.example.com", true).ok).toBe(false);
    expect(validateRelayUrl("http://ws.example.com", false).ok).toBe(false);
  });

  it("rejects ws:// on an HTTPS page, explaining mixed content will be blocked", () => {
    const result = validateRelayUrl("ws://ws.example.com", true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wss://");
  });

  it("still allows ws://localhost on an HTTPS page — browsers exempt localhost", () => {
    expect(validateRelayUrl("ws://localhost:8765", true)).toEqual({ ok: true });
    expect(validateRelayUrl("ws://127.0.0.1:8765", true)).toEqual({ ok: true });
  });

  it("tolerates surrounding whitespace (people paste with spaces)", () => {
    expect(validateRelayUrl("  wss://ws.example.com  ", true)).toEqual({ ok: true });
  });
});

describe("relay URL persistence", () => {
  beforeEach(async () => {
    await clearSavedRelayUrl();
  });

  it("returns undefined when nothing has been saved", async () => {
    expect(await loadSavedRelayUrl()).toBeUndefined();
  });

  it("round-trips a saved address", async () => {
    await saveRelayUrl("wss://ws.example.com");
    expect(await loadSavedRelayUrl()).toBe("wss://ws.example.com");
  });

  it("trims whitespace before saving", async () => {
    await saveRelayUrl("  wss://ws.example.com  ");
    expect(await loadSavedRelayUrl()).toBe("wss://ws.example.com");
  });

  it("overwrites a previously saved address", async () => {
    await saveRelayUrl("wss://old.example.com");
    await saveRelayUrl("wss://new.example.com");
    expect(await loadSavedRelayUrl()).toBe("wss://new.example.com");
  });

  it("clearing removes it so the build-time default takes over again", async () => {
    await saveRelayUrl("wss://ws.example.com");
    await clearSavedRelayUrl();
    expect(await loadSavedRelayUrl()).toBeUndefined();
  });
});
