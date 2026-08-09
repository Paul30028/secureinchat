import { describe, expect, it } from "vitest";
import { parseSic2Invite } from "@secureinchat/protocol";
import { rotateGroupKey, shouldAdoptInvite } from "../src/keyRotation";

const base = {
  groupId: "g1",
  groupName: "同心同行",
  currentEpoch: 0,
  serverJoinCode: "ABCD",
  adminPublicKeyRawB64Url: "BFakePublicKey",
};

describe("rotateGroupKey", () => {
  it("bumps the epoch by one", () => {
    expect(rotateGroupKey(base).epoch).toBe(1);
    expect(rotateGroupKey({ ...base, currentEpoch: 7 }).epoch).toBe(8);
  });

  it("produces fresh key material each time", () => {
    const a = rotateGroupKey(base);
    const b = rotateGroupKey(base);
    expect(a.keyMaterialB64Url).not.toBe(b.keyMaterialB64Url);
  });

  it("issues an invite carrying the new epoch and key material", () => {
    const result = rotateGroupKey(base);
    const parsed = parseSic2Invite(result.inviteCode);
    expect(parsed.epoch).toBe(1);
    expect(parsed.keyMaterialB64Url).toBe(result.keyMaterialB64Url);
  });

  it("keeps the same group id and name, so it's a rotation not a new group", () => {
    const parsed = parseSic2Invite(rotateGroupKey(base).inviteCode);
    expect(parsed.groupId).toBe("g1");
    expect(parsed.groupName).toBe("同心同行");
  });

  it("keeps the admin public key — rotating the group key doesn't change who publishes", () => {
    const parsed = parseSic2Invite(rotateGroupKey(base).inviteCode);
    expect(parsed.adminPublicKeyRawB64Url).toBe("BFakePublicKey");
  });
});

describe("shouldAdoptInvite", () => {
  const current = { groupId: "g1", epoch: 3 };

  function inviteAt(epoch: number, groupId = "g1") {
    return parseSic2Invite(
      rotateGroupKey({ ...base, groupId, currentEpoch: epoch - 1 }).inviteCode
    );
  }

  it("adopts a higher epoch — someone rotated the key", () => {
    expect(shouldAdoptInvite(current, inviteAt(4))).toBe(true);
  });

  it("ignores the same epoch", () => {
    expect(shouldAdoptInvite(current, inviteAt(3))).toBe(false);
  });

  it("ignores a lower epoch — otherwise replaying an old invite would downgrade the group and let a removed member back in", () => {
    expect(shouldAdoptInvite(current, inviteAt(1))).toBe(false);
  });

  it("ignores an invite for a different group entirely", () => {
    expect(shouldAdoptInvite(current, inviteAt(9, "other-group"))).toBe(false);
  });
});
