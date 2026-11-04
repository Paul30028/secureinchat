import { describe, expect, it } from "vitest";
import { getDeviceStore, getDeviceIdentity, __resetForTests } from "../src/deviceIdentity";
import { wipeAllLocalData, LOCAL_DATABASES } from "../src/wipe";

const bytes = new TextEncoder().encode("secret group key");

describe("wipeAllLocalData", () => {
  it("deletes every database even while the app still holds open connections", async () => {
    __resetForTests();
    const store = await getDeviceStore();
    await getDeviceIdentity();
    await store.set("group:g1:epoch:0", bytes);
    expect(await store.listKeys()).toContain("group:g1:epoch:0");

    // 不关闭上面的连接，模拟 App 运行中直接点「全部清除」
    const result = await wipeAllLocalData();
    expect(result.failed).toEqual([]);
    expect(result.deleted).toEqual([...LOCAL_DATABASES]);

    __resetForTests();
    const fresh = await getDeviceStore();
    expect(await fresh.listKeys()).toEqual([]);
  }, 30_000);

  it("the old store object can be used again after a wipe (reopens instead of throwing)", async () => {
    __resetForTests();
    const store = await getDeviceStore();
    await store.set("k", bytes);
    await wipeAllLocalData();
    await expect(store.listKeys()).resolves.toEqual([]);
  }, 30_000);
});
