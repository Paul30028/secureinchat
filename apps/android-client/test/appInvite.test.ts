import { describe, expect, it } from "vitest";
import { formatExpiry, mapParseErrorReason, parsedInviteFor } from "../src/app/invite";
import { setLocale } from "../src/i18n";

const NOW = 1_800_000_000_000;
const H = 3_600_000;

describe("formatExpiry", () => {
  it("says expired at or after the deadline", () => {
    expect(formatExpiry(NOW, NOW)).toBe("已过期");
    expect(formatExpiry(NOW - 1, NOW)).toBe("已过期");
  });

  it("uses days and hours, hours, or at least one minute", () => {
    expect(formatExpiry(NOW + 50 * H, NOW)).toBe("有效期剩 2 天 2 小时");
    expect(formatExpiry(NOW + 5 * H, NOW)).toBe("有效期剩 5 小时");
    expect(formatExpiry(NOW + 10_000, NOW)).toBe("有效期剩 1 分钟");
  });

  it("follows the language, with singular and plural", () => {
    setLocale("en");
    expect(formatExpiry(NOW + 1 * H, NOW)).toBe("Expires in 1 hour");
    expect(formatExpiry(NOW + 3 * H, NOW)).toBe("Expires in 3 hours");
    setLocale("es");
    expect(formatExpiry(NOW + 30 * 60_000, NOW)).toBe("Caduca en 30 minutos");
  });
});

describe("mapParseErrorReason", () => {
  it("keeps the two user-facing reasons and folds protocol details into malformed", () => {
    expect(mapParseErrorReason("expired")).toBe("expired");
    expect(mapParseErrorReason("exhausted")).toBe("exhausted");
    expect(mapParseErrorReason("invalid-json" as never)).toBe("malformed");
  });
});

describe("parsedInviteFor", () => {
  const base = { groupId: "g1", groupName: "G", keyMaterialB64Url: "km", epoch: 3, joinedAtMs: 1, lastReadAtMs: 1 };

  it("builds a SIC2 invite from a remembered group", () => {
    expect(parsedInviteFor(base)).toEqual({
      version: "SIC2",
      isCompatMode: false,
      serverJoinCode: "",
      groupId: "g1",
      keyMaterialB64Url: "km",
      epoch: 3,
    });
  });

  it("carries the admin public key only when there is one", () => {
    expect(parsedInviteFor({ ...base, adminPublicKeyRawB64Url: "pk" }).adminPublicKeyRawB64Url).toBe("pk");
    expect("adminPublicKeyRawB64Url" in parsedInviteFor(base)).toBe(false);
  });
});
