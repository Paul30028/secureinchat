import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BrowserKeystore } from "../src/browserKeystore";
import { TestOnlyInMemoryKeystore, type KeystorePort } from "../src/keystorePort";

const data = new TextEncoder().encode("x");

for (const [name, make] of [
  ["BrowserKeystore", () => new BrowserKeystore()],
  ["TestOnlyInMemoryKeystore", () => new TestOnlyInMemoryKeystore()],
] as const) {
  describe(`${name}.deleteKeyPair`, () => {
    it("removes the key pair so it can no longer sign", async () => {
      const ks: KeystorePort = make();
      await ks.generateDeviceKeyPair(`${name}-del-a`);
      await ks.deleteKeyPair(`${name}-del-a`);
      await expect(ks.sign(`${name}-del-a`, data)).rejects.toThrow();
    });

    it("does not touch other aliases, and deleting a missing alias is fine", async () => {
      const ks: KeystorePort = make();
      await ks.generateDeviceKeyPair(`${name}-keep`);
      await ks.generateDeviceKeyPair(`${name}-gone`);
      await ks.deleteKeyPair(`${name}-gone`);
      await ks.deleteKeyPair(`${name}-never-existed`);
      const sig = await ks.sign(`${name}-keep`, data);
      expect(await ks.verify(`${name}-keep`, data, sig)).toBe(true);
    });

    it("generating again after delete gives a different public key", async () => {
      const ks: KeystorePort = make();
      await ks.generateDeviceKeyPair(`${name}-regen`);
      const before = await ks.exportPublicKeyRaw(`${name}-regen`);
      await ks.deleteKeyPair(`${name}-regen`);
      await ks.generateDeviceKeyPair(`${name}-regen`);
      const after = await ks.exportPublicKeyRaw(`${name}-regen`);
      expect(Buffer.from(after).equals(Buffer.from(before))).toBe(false);
    });
  });
}
