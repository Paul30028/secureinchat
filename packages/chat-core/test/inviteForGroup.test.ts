import { describe, expect, it } from "vitest";
import { parseInviteAuto } from "@secureinchat/protocol";
import { buildInviteForGroup, rotateGroupKey, shouldAdoptInvite } from "../src/keyRotation";

const baseGroup = {
  groupId: "group-abc",
  groupName: "测试群",
  keyMaterialB64Url: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  epoch: 0,
  adminPublicKeyRawB64Url: "PUBKEY_RAW_B64URL",
};

describe("buildInviteForGroup", () => {
  it("round-trips through parseInviteAuto", () => {
    const code = buildInviteForGroup(baseGroup);
    const parsed = parseInviteAuto(code);
    expect(parsed.groupId).toBe(baseGroup.groupId);
    expect(parsed.groupName).toBe(baseGroup.groupName);
    expect(parsed.epoch).toBe(baseGroup.epoch);
    expect(parsed.keyMaterialB64Url).toBe(baseGroup.keyMaterialB64Url);
    expect(parsed.adminPublicKeyRawB64Url).toBe(baseGroup.adminPublicKeyRawB64Url);
  });

  it("works without an admin public key", () => {
    const noAdmin = {
      groupId: baseGroup.groupId,
      groupName: baseGroup.groupName,
      keyMaterialB64Url: baseGroup.keyMaterialB64Url,
      epoch: baseGroup.epoch,
    };
    const code = buildInviteForGroup(noAdmin);
    const parsed = parseInviteAuto(code);
    expect(parsed.groupId).toBe(baseGroup.groupId);
    expect(parsed.groupName).toBe(baseGroup.groupName);
    expect(parsed.adminPublicKeyRawB64Url).toBeUndefined();
  });

  it("accepts an explicit serverJoinCode", () => {
    const code = buildInviteForGroup(baseGroup, "ABCD1234");
    const parsed = parseInviteAuto(code);
    expect(parsed.groupId).toBe(baseGroup.groupId);
  });

  it("after rotation, the invite has a higher epoch and should be adopted", () => {
    const rotated = rotateGroupKey({
      groupId: baseGroup.groupId,
      groupName: baseGroup.groupName,
      currentEpoch: baseGroup.epoch,
      adminPublicKeyRawB64Url: baseGroup.adminPublicKeyRawB64Url,
      serverJoinCode: "ABCD1234",
    });
    const code = buildInviteForGroup({
      groupId: baseGroup.groupId,
      groupName: baseGroup.groupName,
      keyMaterialB64Url: rotated.keyMaterialB64Url,
      epoch: rotated.epoch,
      adminPublicKeyRawB64Url: baseGroup.adminPublicKeyRawB64Url,
    });
    const parsed = parseInviteAuto(code);
    expect(parsed.epoch).toBe(baseGroup.epoch + 1);
    expect(parsed.keyMaterialB64Url).toBe(rotated.keyMaterialB64Url);
    expect(
      shouldAdoptInvite({ groupId: baseGroup.groupId, epoch: baseGroup.epoch }, parsed)
    ).toBe(true);
  });
});
