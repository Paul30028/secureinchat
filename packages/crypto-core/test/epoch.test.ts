import { describe, expect, it } from "vitest";
import { decryptAead, encryptAead } from "../src/aead";
import { InMemoryGroupEpochManager } from "../src/epoch";

function randomKeyMaterial(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

describe("InMemoryGroupEpochManager", () => {
  it("starts at epoch 0 by default", async () => {
    const mgr = await InMemoryGroupEpochManager.create(randomKeyMaterial(), "group-1");
    expect(mgr.currentEpoch()).toBe(0);
    expect(mgr.getKeyForEpoch(0)).toBeDefined();
  });

  it("rotate() increments epoch and produces a different key", async () => {
    const mgr = await InMemoryGroupEpochManager.create(randomKeyMaterial(), "group-1");
    const keyBefore = mgr.getKeyForEpoch(0)!;
    const newEpoch = await mgr.rotate();
    expect(newEpoch).toBe(1);
    expect(mgr.currentEpoch()).toBe(1);
    const keyAfter = mgr.getKeyForEpoch(1)!;
    expect(keyBefore).not.toBe(keyAfter);
  });

  it("removed-member simulation: old epoch key cannot decrypt post-rotation messages", async () => {
    const material = randomKeyMaterial();
    const mgr = await InMemoryGroupEpochManager.create(material, "group-1");
    const epoch0Key = mgr.getKeyForEpoch(0)!;

    // A member is removed -> rotate.
    await mgr.rotate();
    const epoch1Key = mgr.getKeyForEpoch(1)!;

    const aad = new TextEncoder().encode("group-1:seq-1:epoch-1");
    const ct = await encryptAead(epoch1Key, new TextEncoder().encode("post-removal secret"), aad);

    // The removed member only ever had the epoch 0 key.
    await expect(decryptAead(epoch0Key, ct, aad)).rejects.toThrow();
  });

  it("same group id + epoch deterministically derives the same key across instances", async () => {
    const material = randomKeyMaterial();
    const mgrA = await InMemoryGroupEpochManager.create(material, "group-X", 2);
    const mgrB = await InMemoryGroupEpochManager.create(material, "group-X", 2);
    const aad = new TextEncoder().encode("ctx");
    const ct = await encryptAead(mgrA.getKeyForEpoch(2)!, new TextEncoder().encode("hi"), aad);
    const pt = await decryptAead(mgrB.getKeyForEpoch(2)!, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("hi");
  });

  it("different group ids never derive the same key even with identical material/epoch", async () => {
    const material = randomKeyMaterial();
    const mgrA = await InMemoryGroupEpochManager.create(material, "group-A", 0);
    const mgrB = await InMemoryGroupEpochManager.create(material, "group-B", 0);
    const aad = new Uint8Array();
    const ct = await encryptAead(mgrA.getKeyForEpoch(0)!, new TextEncoder().encode("hi"), aad);
    await expect(decryptAead(mgrB.getKeyForEpoch(0)!, ct, aad)).rejects.toThrow();
  });
});
