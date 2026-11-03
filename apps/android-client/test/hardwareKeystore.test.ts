import { describe, expect, it } from "vitest";
import { HardwareKeyError } from "@secureinchat/secure-storage";
import { createHardwareKeyWrapper, nativeHardwareKeyWrapper, type HardwareKeystorePlugin } from "../src/hardwareKeystore";

/** 模拟插件：wrap 原样回传（只测桥接层的编码和错误映射，加密由 Keystore 负责）。 */
function fakePlugin(overrides: Partial<HardwareKeystorePlugin> = {}): HardwareKeystorePlugin {
  return {
    ensureKey: async () => ({ level: "tee" }),
    wrap: async ({ data }) => ({ data }),
    unwrap: async ({ data }) => ({ data }),
    deleteKey: async () => undefined,
    ...overrides,
  };
}

function rejectWith(code: string) {
  return async () => {
    throw Object.assign(new Error(`native ${code}`), { code });
  };
}

describe("createHardwareKeyWrapper", () => {
  it("round-trips every byte value through base64", async () => {
    const w = createHardwareKeyWrapper(fakePlugin());
    const raw = new Uint8Array(256).map((_, i) => i);
    const wrapped = await w.wrap(raw, new Uint8Array([1, 2]));
    expect(await w.unwrap(wrapped, new Uint8Array([1, 2]))).toEqual(raw);
  });

  it("passes the AAD to the plugin", async () => {
    let seen = "";
    const w = createHardwareKeyWrapper(
      fakePlugin({
        unwrap: async ({ data, aad }) => {
          seen = aad;
          return { data };
        },
      })
    );
    await w.unwrap(new Uint8Array([7]), new TextEncoder().encode("ctx"));
    expect(atob(seen)).toBe("ctx");
  });

  it.each([
    ["KEY_MISSING", "missing"],
    ["KEY_INVALIDATED", "invalidated"],
    ["UNWRAP_FAILED", "failed"],
    ["KEYSTORE_ERROR", "failed"],
  ])("maps plugin code %s to %s", async (code, kind) => {
    const w = createHardwareKeyWrapper(fakePlugin({ unwrap: rejectWith(code) }));
    const err = await w.unwrap(new Uint8Array([1]), new Uint8Array()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HardwareKeyError);
    expect((err as HardwareKeyError).kind).toBe(kind);
  });

  it("an unknown security level is reported as the lowest, never higher", async () => {
    const w = createHardwareKeyWrapper(fakePlugin({ ensureKey: async () => ({ level: "titan" }) }));
    expect(await w.ensureKey()).toBe("software");
  });

  it("known levels pass through", async () => {
    for (const level of ["strongbox", "tee", "software"]) {
      const w = createHardwareKeyWrapper(fakePlugin({ ensureKey: async () => ({ level }) }));
      expect(await w.ensureKey()).toBe(level);
    }
  });
});

describe("nativeHardwareKeyWrapper", () => {
  it("is null off Android (web keeps the old, lower protection)", () => {
    expect(nativeHardwareKeyWrapper()).toBeNull();
  });
});
