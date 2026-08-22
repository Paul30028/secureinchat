import { describe, expect, it } from "vitest";
import {
  buildSic1Invite,
  buildSic2Invite,
  InviteParseError,
  parseInviteAuto,
  parseSic1Invite,
  parseSic2Invite,
} from "../src/index";

describe("SIC1 (legacy compat)", () => {
  it("round-trips a valid invite", () => {
    const raw = buildSic1Invite({ serverJoinCode: "ABCD1234", keyMaterialB64Url: "abcXYZ_-09" });
    const parsed = parseSic1Invite(raw);
    expect(parsed.version).toBe("SIC1");
    expect(parsed.isCompatMode).toBe(true);
    expect(parsed.serverJoinCode).toBe("ABCD1234");
    expect(parsed.keyMaterialB64Url).toBe("abcXYZ_-09");
  });

  it("rejects wrong prefix", () => {
    expect(() => parseSic1Invite("SIC2.foo.bar")).toThrow(InviteParseError);
  });

  it("rejects malformed segment count", () => {
    expect(() => parseSic1Invite("SIC1.onlyonepart")).toThrow(InviteParseError);
  });

  it("rejects invalid base64url key material", () => {
    expect(() => parseSic1Invite("SIC1.CODE.not valid base64!")).toThrow(InviteParseError);
  });

  it("rejects empty input", () => {
    expect(() => parseSic1Invite("")).toThrow(InviteParseError);
  });
});

describe("SIC2 (current protocol)", () => {
  it("round-trips a valid invite with epoch/expiry/uses", () => {
    const future = Date.now() + 1000 * 60 * 60 * 24;
    const raw = buildSic2Invite({
      serverJoinCode: "ABCD1234",
      groupId: "group-xyz",
      keyMaterialB64Url: "abcXYZ_-09",
      epoch: 3,
      expiresAtMs: future,
      remainingUses: 5,
    });
    const parsed = parseSic2Invite(raw);
    expect(parsed.version).toBe("SIC2");
    expect(parsed.isCompatMode).toBe(false);
    expect(parsed.groupId).toBe("group-xyz");
    expect(parsed.epoch).toBe(3);
    expect(parsed.expiresAtMs).toBe(future);
    expect(parsed.remainingUses).toBe(5);
  });

  it("rejects expired invites", () => {
    const past = Date.now() - 1000;
    const raw = buildSic2Invite({ serverJoinCode: "X", groupId: "g1", keyMaterialB64Url: "abc", epoch: 0, expiresAtMs: past });
    expect(() => parseSic2Invite(raw)).toThrow(InviteParseError);
    try {
      parseSic2Invite(raw);
    } catch (e) {
      expect((e as InviteParseError).reason).toBe("expired");
    }
  });

  it("rejects exhausted invites", () => {
    const raw = buildSic2Invite({ serverJoinCode: "X", groupId: "g1", keyMaterialB64Url: "abc", epoch: 0, remainingUses: 0 });
    expect(() => parseSic2Invite(raw)).toThrow(InviteParseError);
    try {
      parseSic2Invite(raw);
    } catch (e) {
      expect((e as InviteParseError).reason).toBe("exhausted");
    }
  });

  it("rejects a SIC2 invite missing groupId", () => {
    const raw = buildSic2Invite({ serverJoinCode: "X", keyMaterialB64Url: "abc", epoch: 0 }); // no groupId
    try {
      parseSic2Invite(raw);
      expect.fail("expected parseSic2Invite to throw");
    } catch (e) {
      expect((e as InviteParseError).reason).toBe("malformed-segments");
    }
  });

  it("rejects tampered payload (invalid base64url)", () => {
    expect(() => parseSic2Invite("SIC2.not-json-and-not-even-valid!")).toThrow(InviteParseError);
  });

  it("rejects unsupported payload version", () => {
    const raw = buildSic2Invite({ serverJoinCode: "X", keyMaterialB64Url: "abc", epoch: 0 });
    const tampered = raw.replace("SIC2.", "SIC2.");
    // Build a v:1 payload manually to simulate a downgrade/tamper attempt.
    const forged = Buffer.from(JSON.stringify({ v: 1, sjc: "X", km: "abc", epoch: 0 })).toString("base64url");
    expect(() => parseSic2Invite(`SIC2.${forged}`)).toThrow(InviteParseError);
    void tampered;
  });
});

describe("parseInviteAuto", () => {
  it("dispatches to SIC2 when prefixed SIC2.", () => {
    const raw = buildSic2Invite({ serverJoinCode: "X", groupId: "g1", keyMaterialB64Url: "abc", epoch: 0 });
    expect(parseInviteAuto(raw).version).toBe("SIC2");
  });

  it("dispatches to SIC1 when prefixed SIC1.", () => {
    const raw = buildSic1Invite({ serverJoinCode: "X", keyMaterialB64Url: "abc" });
    expect(parseInviteAuto(raw).version).toBe("SIC1");
  });

  it("throws on unknown prefix", () => {
    expect(() => parseInviteAuto("SIC9.whatever")).toThrow(InviteParseError);
  });
});

describe("SIC2 group name", () => {
  it("round-trips the group name so joiners see the real name, not a placeholder", () => {
    const raw = buildSic2Invite({
      serverJoinCode: "X",
      groupId: "g1",
      groupName: "周末爬山小队",
      keyMaterialB64Url: "abc",
      epoch: 0,
    });
    expect(parseSic2Invite(raw).groupName).toBe("周末爬山小队");
  });

  it("omits the field entirely when no name was given (older invites stay valid)", () => {
    const raw = buildSic2Invite({ serverJoinCode: "X", groupId: "g1", keyMaterialB64Url: "abc", epoch: 0 });
    expect(parseSic2Invite(raw).groupName).toBeUndefined();
  });

  it("handles names with spaces and emoji", () => {
    const raw = buildSic2Invite({
      serverJoinCode: "X",
      groupId: "g1",
      groupName: "读书会 📚 周三组",
      keyMaterialB64Url: "abc",
      epoch: 0,
    });
    expect(parseSic2Invite(raw).groupName).toBe("读书会 📚 周三组");
  });
});
