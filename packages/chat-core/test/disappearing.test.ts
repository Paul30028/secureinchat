import { describe, expect, it } from "vitest";
import {
  DISAPPEAR_OPTIONS_MS,
  sanitizeExpiresInMs,
  expiresAtFor,
  partitionExpired,
  nextExpiryMs,
} from "../src/disappearing";

describe("sanitizeExpiresInMs", () => {
  it("accepts the boundary values", () => {
    expect(sanitizeExpiresInMs(60_000)).toBe(60_000);
    expect(sanitizeExpiresInMs(7 * 86_400_000)).toBe(7 * 86_400_000);
  });

  it("rejects below the minimum", () => {
    expect(sanitizeExpiresInMs(59_999)).toBeUndefined();
    expect(sanitizeExpiresInMs(0)).toBeUndefined();
    expect(sanitizeExpiresInMs(-1)).toBeUndefined();
  });

  it("rejects above the maximum", () => {
    expect(sanitizeExpiresInMs(7 * 86_400_000 + 1)).toBeUndefined();
  });

  it("rejects non-finite and non-number", () => {
    expect(sanitizeExpiresInMs(Number.NaN)).toBeUndefined();
    expect(sanitizeExpiresInMs(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(sanitizeExpiresInMs("300000")).toBeUndefined();
    expect(sanitizeExpiresInMs(null)).toBeUndefined();
    expect(sanitizeExpiresInMs(undefined)).toBeUndefined();
  });

  it("rejects fractions instead of rounding them", () => {
    expect(sanitizeExpiresInMs(60_000.4)).toBeUndefined();
    expect(sanitizeExpiresInMs(59_999.6)).toBeUndefined();
  });
});

describe("expiresAtFor", () => {
  it("returns undefined when there is no duration", () => {
    expect(expiresAtFor(1000, undefined)).toBeUndefined();
  });

  it("adds the duration to the receive time", () => {
    expect(expiresAtFor(1000, 5000)).toBe(6000);
  });
});

describe("partitionExpired", () => {
  it("keeps items without an expiry", () => {
    const items = [{ id: "a" }, { id: "b", expiresAtMs: 5000 }];
    const { keep, expired } = partitionExpired(items, 1000);
    expect(keep.map((i) => i.id)).toEqual(["a", "b"]);
    expect(expired).toEqual([]);
  });

  it("splits at the current time, counting equality as expired", () => {
    const items = [
      { id: "past", expiresAtMs: 500 },
      { id: "now", expiresAtMs: 1000 },
      { id: "future", expiresAtMs: 1500 },
    ];
    const { keep, expired } = partitionExpired(items, 1000);
    expect(keep.map((i) => i.id)).toEqual(["future"]);
    expect(expired.map((i) => i.id)).toEqual(["past", "now"]);
  });

  it("handles an empty list", () => {
    expect(partitionExpired([], 1000)).toEqual({ keep: [], expired: [] });
  });
});

describe("nextExpiryMs", () => {
  it("returns undefined for an empty list", () => {
    expect(nextExpiryMs([])).toBeUndefined();
  });

  it("returns undefined when nothing has an expiry", () => {
    expect(nextExpiryMs([{ id: "a" }])).toBeUndefined();
  });

  it("returns the earliest expiry", () => {
    expect(
      nextExpiryMs([{ expiresAtMs: 3000 }, { expiresAtMs: 1000 }, { expiresAtMs: 2000 }])
    ).toBe(1000);
  });

  it("ignores non-finite values", () => {
    expect(nextExpiryMs([{ expiresAtMs: Number.NaN }, { expiresAtMs: 2000 }])).toBe(2000);
  });
});

describe("DISAPPEAR_OPTIONS_MS", () => {
  it("lists the expected options in order", () => {
    expect([...DISAPPEAR_OPTIONS_MS]).toEqual([
      0,
      300_000,
      3_600_000,
      86_400_000,
      604_800_000,
    ]);
  });
});
