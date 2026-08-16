import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { validateNickname, displayNameFor, NICKNAME_MAX_LENGTH } from "../src/profile";

describe("validateNickname", () => {
  it("accepts an ordinary name", () => {
    expect(validateNickname("李阳")).toEqual({ ok: true });
  });

  it("rejects an empty name", () => {
    expect(validateNickname("   ").ok).toBe(false);
  });

  it("rejects an over-long name", () => {
    expect(validateNickname("字".repeat(NICKNAME_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("rejects 我 — on everyone else's phone that reads as their own message", () => {
    // 真机上就出现过：对方昵称是"我"，所以每条他发的消息头上都写着"我"
    const result = validateNickname("我");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("别人能认出你");
  });

  it("rejects other first-person names too", () => {
    for (const name of ["本人", "自己", "me", "Me"]) {
      expect(validateNickname(name).ok).toBe(false);
    }
  });

  it("still allows a name that merely contains 我", () => {
    expect(validateNickname("我是李阳")).toEqual({ ok: true });
  });

  it("trims before checking, so ' 我 ' is caught too", () => {
    expect(validateNickname("  我  ").ok).toBe(false);
  });
});

describe("displayNameFor", () => {
  it("prefers the nickname", () => {
    expect(displayNameFor("李阳", "device-abc123")).toBe("李阳");
  });

  it("falls back to a short device label when there's no nickname", () => {
    expect(displayNameFor(undefined, "device-abc123")).toBe("用户abc123");
  });

  it("treats a blank nickname as absent", () => {
    expect(displayNameFor("   ", "device-abc123")).toBe("用户abc123");
  });
});
