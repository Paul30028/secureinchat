import { describe, expect, it } from "vitest";
import { generateAdminKeyPair } from "../src/adminSignature";
import { nextAdminSetBody, signAdminSet } from "../src/adminSet";
import { TestOnlyInMemoryKeystore } from "../src/keystorePort";
import {
  checkObservedDevices,
  computeInviteTag,
  decideJoinRequest,
  generateInviteSecret,
  nextRosterBody,
  shouldAdoptRoster,
  signJoinRequest,
  signRoster,
  validateRosterBody,
  verifyJoinRequest,
  verifyRoster,
  type IssuedInvite,
  type JoinRequestBody,
  type RosterEntry,
  type SignedJoinRequest,
} from "../src/deviceRoster";

const GID = "g2-roster";

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function newDevice(ks: TestOnlyInMemoryKeystore, id: string) {
  await ks.generateDeviceKeyPair(id);
  const pk = b64url(await ks.exportPublicKeyRaw(id));
  return { deviceId: id, pk, sign: (d: Uint8Array) => ks.sign(id, d) };
}

function entry(d: { deviceId: string; pk: string }, name: string): RosterEntry {
  return { deviceId: d.deviceId, devicePublicKeyRawB64Url: d.pk, name, approvedAtMs: 1 };
}

async function joinReq(
  d: { deviceId: string; pk: string; sign: (x: Uint8Array) => Promise<Uint8Array> },
  extra: Partial<JoinRequestBody> = {}
): Promise<SignedJoinRequest> {
  return signJoinRequest(d.sign, {
    groupId: GID,
    deviceId: d.deviceId,
    devicePublicKeyRawB64Url: d.pk,
    name: "张三",
    requestedAtMs: 5,
    ...extra,
  });
}

describe("设备名单(C-ROSTER)", () => {
  it("主管理员或当前副管理员签的名单有效;外人、被撤销的副管理员签的无效", async () => {
    const root = await generateAdminKeyPair();
    const deputy = await generateAdminKeyPair();
    const outsider = await generateAdminKeyPair();
    const rk = root.publicKeyRawB64Url;
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const set1 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, undefined, { add: [{ publicKeyRawB64Url: deputy.publicKeyRawB64Url, label: "D" }] }, 1));
    const set2 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, set1, { remove: [deputy.publicKeyRawB64Url] }, 2));

    const body = nextRosterBody(GID, undefined, 1, { add: [entry(d1, "一号")] }, 10);
    const byRoot = await signRoster(root.privateKey, rk, body);
    const byDeputy = await signRoster(deputy.privateKey, deputy.publicKeyRawB64Url, body);
    const byOutsider = await signRoster(outsider.privateKey, outsider.publicKeyRawB64Url, body);

    expect(await verifyRoster(rk, set1, GID, byRoot)).toBe(true);
    expect(await verifyRoster(rk, set1, GID, byDeputy)).toBe(true);
    expect(await verifyRoster(rk, set1, GID, byOutsider)).toBe(false);
    // 撤销之后,他签过的名单也不再有效
    expect(await verifyRoster(rk, set2, GID, byDeputy)).toBe(false);
    // 冒用别人的公钥字段:签名人写成主管理员,但实际是外人签的
    expect(await verifyRoster(rk, set1, GID, { ...byOutsider, signerPublicKeyRawB64Url: rk })).toBe(false);
    // 换群
    expect(await verifyRoster(rk, set1, "g2-other", byRoot)).toBe(false);
    // 名单引用了本机还没见过的管理员名单版本
    expect(await verifyRoster(rk, undefined, GID, byRoot)).toBe(false);
  });

  it("篡改条目(换公钥、改名)签名就失效", async () => {
    const root = await generateAdminKeyPair();
    const rk = root.publicKeyRawB64Url;
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const signed = await signRoster(root.privateKey, rk, nextRosterBody(GID, undefined, 0, { add: [entry(d1, "一号")] }, 10));
    expect(await verifyRoster(rk, undefined, GID, signed)).toBe(true);
    const swapped = { ...signed, body: { ...signed.body, entries: [{ ...signed.body.entries[0]!, devicePublicKeyRawB64Url: d2.pk }] } };
    expect(await verifyRoster(rk, undefined, GID, swapped)).toBe(false);
    const renamed = { ...signed, body: { ...signed.body, entries: [{ ...signed.body.entries[0]!, name: "管理员" }] } };
    expect(await verifyRoster(rk, undefined, GID, renamed)).toBe(false);
  });

  it("结构检查:deviceId 不能重复、版本从 1 开始", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const ok = nextRosterBody(GID, undefined, 0, { add: [entry(d1, "一号")] }, 1);
    expect(validateRosterBody(ok)).toBe(true);
    expect(validateRosterBody({ ...ok, entries: [ok.entries[0], ok.entries[0]] })).toBe(false);
    expect(validateRosterBody({ ...ok, version: 0 })).toBe(false);
    expect(validateRosterBody({ ...ok, entries: [{ ...ok.entries[0]!, devicePublicKeyRawB64Url: "x" }] })).toBe(false);
  });

  it("版本更大才采纳;同版本两个管理员各签一份时,所有客户端选同一份", async () => {
    const root = await generateAdminKeyPair();
    const deputy = await generateAdminKeyPair();
    const rk = root.publicKeyRawB64Url;
    const set1 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, undefined, { add: [{ publicKeyRawB64Url: deputy.publicKeyRawB64Url, label: "D" }] }, 1));
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const d3 = await newDevice(ks, "device-3");
    const v1 = await signRoster(root.privateKey, rk, nextRosterBody(GID, undefined, 1, { add: [entry(d1, "一")] }, 1));
    const v2a = await signRoster(root.privateKey, rk, nextRosterBody(GID, v1.body, 1, { add: [entry(d2, "二")] }, 2));
    const v2b = await signRoster(deputy.privateKey, deputy.publicKeyRawB64Url, nextRosterBody(GID, v1.body, 1, { add: [entry(d3, "三")] }, 2));

    expect(await shouldAdoptRoster(rk, set1, GID, v1, v2a)).toEqual({ adopt: true });
    expect(await shouldAdoptRoster(rk, set1, GID, v2a, v1)).toEqual({ adopt: false, reason: "not-newer" });
    const ab = (await shouldAdoptRoster(rk, set1, GID, v2a, v2b)).adopt;
    const ba = (await shouldAdoptRoster(rk, set1, GID, v2b, v2a)).adopt;
    // 恰好一个方向会换:两台客户端无论先收到哪份,最后都停在同一份
    expect(ab !== ba).toBe(true);
  });

  it("nextRosterBody:加、删、同 ID 覆盖", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const v1 = nextRosterBody(GID, undefined, 0, { add: [entry(d1, "一"), entry(d2, "二")] }, 1);
    const v2 = nextRosterBody(GID, v1, 0, { removeDeviceIds: ["device-1"] }, 2);
    expect(v2.version).toBe(2);
    expect(v2.entries.map((e) => e.deviceId)).toEqual(["device-2"]);
    const v3 = nextRosterBody(GID, v2, 0, { add: [entry(d2, "二号改名")] }, 3);
    expect(v3.entries).toHaveLength(1);
    expect(v3.entries[0]!.name).toBe("二号改名");
  });

  it("自动对照:名单内、不在名单、公钥不符", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const roster = nextRosterBody(GID, undefined, 0, { add: [entry(d1, "一")] }, 1);
    const r = checkObservedDevices(roster, [
      { deviceId: "device-1" },
      { deviceId: "device-x" },
      { deviceId: "device-1", devicePublicKeyRawB64Url: d2.pk },
    ]);
    expect(r.listed).toEqual([{ deviceId: "device-1", name: "一" }]);
    expect(r.unlisted).toEqual(["device-x"]);
    expect(r.keyMismatch).toEqual(["device-1"]);
    // 还没有名单:全部算不在名单(界面应写「管理员还没有发布名单」而不是报警)
    expect(checkObservedDevices(undefined, [{ deviceId: "device-1" }]).unlisted).toEqual(["device-1"]);
  });
});

describe("入群申请与一人一码", () => {
  it("设备私钥签的申请能验过;改任何字段或换群都不行", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const req = await joinReq(d1);
    expect(await verifyJoinRequest(GID, req)).toBe(true);
    expect(await verifyJoinRequest("g2-other", req)).toBe(false);
    expect(await verifyJoinRequest(GID, { ...req, body: { ...req.body, name: "管理员" } })).toBe(false);
    // 拿别的设备的公钥冒充:签名对不上
    expect(await verifyJoinRequest(GID, { ...req, body: { ...req.body, devicePublicKeyRawB64Url: d2.pk } })).toBe(false);
  });

  it("一人一码:标记对得上、邀请没用过 → 自动批准", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const secret = generateInviteSecret();
    const tag = await computeInviteTag(secret, GID, d1.deviceId, d1.pk);
    const invites: IssuedInvite[] = [{ inviteSecretB64Url: generateInviteSecret(), note: "给李四" }, { inviteSecretB64Url: secret, note: "给张三" }];
    const req = await joinReq(d1, { inviteTag: tag });
    expect(await decideJoinRequest(GID, req, undefined, invites)).toEqual({ action: "auto-approve", inviteIndex: 1 });
  });

  it("邀请已经被用过(包括同一台设备再来)→ 交给管理员", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const secret = generateInviteSecret();
    const used: IssuedInvite[] = [{ inviteSecretB64Url: secret, note: "给张三", usedByDeviceId: "device-1" }];
    const r2 = await joinReq(d2, { inviteTag: await computeInviteTag(secret, GID, d2.deviceId, d2.pk) });
    expect(await decideJoinRequest(GID, r2, undefined, used)).toEqual({ action: "manual", reason: "invite-already-used" });
    const r1 = await joinReq(d1, { inviteTag: await computeInviteTag(secret, GID, d1.deviceId, d1.pk) });
    expect(await decideJoinRequest(GID, r1, undefined, used)).toEqual({ action: "manual", reason: "invite-already-used" });
  });

  it("别的设备的标记不能挪用(标记绑定 deviceId 和公钥)", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d2 = await newDevice(ks, "device-2");
    const secret = generateInviteSecret();
    const tagFor1 = await computeInviteTag(secret, GID, d1.deviceId, d1.pk);
    const req = await joinReq(d2, { inviteTag: tagFor1 });
    expect(await decideJoinRequest(GID, req, undefined, [{ inviteSecretB64Url: secret, note: "" }])).toEqual({
      action: "manual",
      reason: "unknown-invite",
    });
  });

  it("没有标记 → 手动;已在名单 → already-listed;同 ID 换了公钥 → 手动;签名坏 → 拒绝", async () => {
    const ks = new TestOnlyInMemoryKeystore();
    const d1 = await newDevice(ks, "device-1");
    const d1b = await newDevice(ks, "device-1b");
    const roster = nextRosterBody(GID, undefined, 0, { add: [entry(d1, "一")] }, 1);
    const plain = await joinReq(d1);
    expect(await decideJoinRequest(GID, plain, undefined, [])).toEqual({ action: "manual", reason: "no-invite-tag" });
    expect(await decideJoinRequest(GID, plain, roster, [])).toEqual({ action: "already-listed" });
    // 新钥匙自称 device-1
    const impostor = await signJoinRequest(d1b.sign, { groupId: GID, deviceId: "device-1", devicePublicKeyRawB64Url: d1b.pk, name: "一", requestedAtMs: 1 });
    expect(await decideJoinRequest(GID, impostor, roster, [])).toEqual({ action: "manual", reason: "device-key-changed" });
    const bad = { ...plain, signature: plain.signature.slice(0, -2) + "AA" };
    expect(await decideJoinRequest(GID, bad, undefined, [])).toEqual({ action: "reject", reason: "bad-signature" });
  });
});
