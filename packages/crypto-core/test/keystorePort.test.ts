import { describe, expect, it } from "vitest";
import { TestOnlyInMemoryKeystore } from "../src/keystorePort";

describe("TestOnlyInMemoryKeystore (reference implementation for tests only)", () => {
  it("generates a key pair and signs/verifies data", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const data = new TextEncoder().encode("attest this");
    const sig = await ks.sign(alias, data);
    const ok = await ks.verify(alias, data, sig);
    expect(ok).toBe(true);
  });

  it("fails verification for tampered data", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const alias = await ks.generateDeviceKeyPair("device-1");
    const data = new TextEncoder().encode("attest this");
    const sig = await ks.sign(alias, data);
    const tampered = new TextEncoder().encode("attest that");
    const ok = await ks.verify(alias, tampered, sig);
    expect(ok).toBe(false);
  });

  it("reports no hardware backing (it is an in-memory test double)", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    expect(await ks.hasHardwareBackedKeystore()).toBe(false);
  });

  it("throws when signing with an unknown alias", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    await expect(ks.sign("does-not-exist", new Uint8Array())).rejects.toThrow();
  });
});
