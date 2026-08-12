import { describe, expect, it } from "vitest";
import { generateAeadKey } from "@secureinchat/crypto-core";
import { EncryptedKeyValueStore, TestOnlyInMemoryStorageBackend } from "@secureinchat/secure-storage";
import {
  loadKnownDevices,
  saveKnownDevices,
  markDeviceSeen,
  sortByRecency,
  forgetAllDevices,
  storageKeyForDevices,
  type KnownDevice,
} from "../src/knownDevices";

async function makeStore() {
  const backend = new TestOnlyInMemoryStorageBackend();
  return { backend, store: new EncryptedKeyValueStore(backend, await generateAeadKey()) };
}

describe("markDeviceSeen", () => {
  it("adds a device never seen before", () => {
    const result = markDeviceSeen([], "d1", 1000, "李阳");
    expect(result).toEqual([{ deviceId: "d1", displayName: "李阳", firstSeenMs: 1000, lastSeenMs: 1000 }]);
  });

  it("updates lastSeen but preserves firstSeen", () => {
    const seen = markDeviceSeen([], "d1", 1000);
    const again = markDeviceSeen(seen, "d1", 5000);
    expect(again[0]).toMatchObject({ firstSeenMs: 1000, lastSeenMs: 5000 });
  });

  it("does not duplicate a device", () => {
    let devices: KnownDevice[] = [];
    for (const t of [1000, 2000, 3000]) devices = markDeviceSeen(devices, "d1", t);
    expect(devices).toHaveLength(1);
  });

  it("picks up a display name learned later", () => {
    const anonymous = markDeviceSeen([], "d1", 1000);
    const named = markDeviceSeen(anonymous, "d1", 2000, "张溪");
    expect(named[0]!.displayName).toBe("张溪");
  });

  it("keeps a known name when a later sighting carries none", () => {
    const named = markDeviceSeen([], "d1", 1000, "张溪");
    const later = markDeviceSeen(named, "d1", 2000);
    expect(later[0]!.displayName).toBe("张溪");
  });

  it("tracks several devices independently", () => {
    let devices: KnownDevice[] = [];
    devices = markDeviceSeen(devices, "d1", 1000);
    devices = markDeviceSeen(devices, "d2", 2000);
    expect(devices.map((d) => d.deviceId)).toEqual(["d1", "d2"]);
  });
});

describe("sortByRecency", () => {
  it("puts the most recently seen first", () => {
    const devices: KnownDevice[] = [
      { deviceId: "old", firstSeenMs: 1, lastSeenMs: 100 },
      { deviceId: "recent", firstSeenMs: 1, lastSeenMs: 900 },
    ];
    expect(sortByRecency(devices).map((d) => d.deviceId)).toEqual(["recent", "old"]);
  });

  it("does not mutate the input", () => {
    const devices: KnownDevice[] = [
      { deviceId: "a", firstSeenMs: 1, lastSeenMs: 1 },
      { deviceId: "b", firstSeenMs: 1, lastSeenMs: 2 },
    ];
    sortByRecency(devices);
    expect(devices[0]!.deviceId).toBe("a");
  });
});

describe("persistence", () => {
  it("starts empty", async () => {
    const { store } = await makeStore();
    expect(await loadKnownDevices(store, "g1")).toEqual([]);
  });

  it("round-trips", async () => {
    const { store } = await makeStore();
    const devices = markDeviceSeen([], "d1", 1000, "李阳");
    await saveKnownDevices(store, "g1", devices);
    expect(await loadKnownDevices(store, "g1")).toEqual(devices);
  });

  it("keeps groups separate", async () => {
    const { store } = await makeStore();
    await saveKnownDevices(store, "g1", markDeviceSeen([], "d1", 1));
    await saveKnownDevices(store, "g2", markDeviceSeen([], "d2", 1));

    expect((await loadKnownDevices(store, "g1"))[0]!.deviceId).toBe("d1");
    expect((await loadKnownDevices(store, "g2"))[0]!.deviceId).toBe("d2");
  });

  it("stores ciphertext — who is in a group is itself sensitive", async () => {
    const { store, backend } = await makeStore();
    await saveKnownDevices(store, "g1", markDeviceSeen([], "device-secret-id", 1, "李阳"));

    const raw = await backend.get(storageKeyForDevices("g1"));
    const text = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    expect(text).not.toContain("device-secret-id");
    expect(text).not.toContain("李阳");
  });

  it("returns empty rather than throwing when the data can't be decrypted", async () => {
    const { store, backend } = await makeStore();
    const other = new EncryptedKeyValueStore(backend, await generateAeadKey());
    await saveKnownDevices(other, "g1", markDeviceSeen([], "d1", 1));

    expect(await loadKnownDevices(store, "g1")).toEqual([]);
  });
});

describe("forgetAllDevices", () => {
  it("clears the list, for use after a key rotation", () => {
    expect(forgetAllDevices()).toEqual([]);
  });
});
