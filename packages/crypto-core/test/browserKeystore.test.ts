import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BrowserKeystore } from "../src/browserKeystore";

describe("BrowserKeystore", () => {
  it("generates a key pair and signs/verifies data", async () => {
    const ks = new BrowserKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const data = new TextEncoder().encode("attest this");
    const sig = await ks.sign(alias, data);
    expect(await ks.verify(alias, data, sig)).toBe(true);
  });

  it("fails verification for tampered data", async () => {
    const ks = new BrowserKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const sig = await ks.sign(alias, new TextEncoder().encode("attest this"));
    expect(await ks.verify(alias, new TextEncoder().encode("attest that"), sig)).toBe(false);
  });

  it("exports a 65-byte uncompressed P-256 public key", async () => {
    const ks = new BrowserKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const raw = await ks.exportPublicKeyRaw(alias);
    expect(raw.byteLength).toBe(65);
    expect(raw[0]).toBe(0x04);
  });

  it("reports no hardware backing (honest — Web Crypto isn't Android StrongBox)", async () => {
    const ks = new BrowserKeystore();
    expect(await ks.hasHardwareBackedKeystore()).toBe(false);
  });

  it("throws when signing with an unknown alias", async () => {
    const ks = new BrowserKeystore();
    await expect(ks.sign("does-not-exist", new Uint8Array())).rejects.toThrow();
  });

  it("calling generateDeviceKeyPair again with the same alias does NOT overwrite the existing key (device identity stays stable)", async () => {
    const ks = new BrowserKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const originalPublicKey = await ks.exportPublicKeyRaw(alias);

    await ks.generateDeviceKeyPair("device-1"); // called again — must be a no-op
    const publicKeyAfter = await ks.exportPublicKeyRaw(alias);

    expect(Array.from(publicKeyAfter)).toEqual(Array.from(originalPublicKey));
  });

  it("the key pair survives being accessed from a fresh instance (simulates a page reload)", async () => {
    const first = new BrowserKeystore();
    const alias = await first.generateDeviceKeyPair("device-1");
    const publicKeyBefore = await first.exportPublicKeyRaw(alias);

    // A brand new instance — same IndexedDB database, but no shared in-memory state.
    const second = new BrowserKeystore();
    const publicKeyAfter = await second.exportPublicKeyRaw(alias);
    expect(Array.from(publicKeyAfter)).toEqual(Array.from(publicKeyBefore));

    // And it can actually still sign/verify using the reloaded instance.
    const data = new TextEncoder().encode("still me after reload");
    const sig = await second.sign(alias, data);
    expect(await first.verify(alias, data, sig)).toBe(true);
  });

  it("different aliases produce independent, unrelated key pairs", async () => {
    const ks = new BrowserKeystore();
    const aliasA = await ks.generateDeviceKeyPair("device-A");
    const aliasB = await ks.generateDeviceKeyPair("device-B");
    const pubA = await ks.exportPublicKeyRaw(aliasA);
    const pubB = await ks.exportPublicKeyRaw(aliasB);
    expect(Array.from(pubA)).not.toEqual(Array.from(pubB));
  });
});
