import { describe, expect, it } from "vitest";
import { generateAdminKeyPair } from "../src/adminSignature";
import {
  activeAdminKeys,
  isActiveAdmin,
  keyIdOf,
  nextAdminSetBody,
  resolveAdminKey,
  shouldAdoptAdminSet,
  signAdminSet,
  validateAdminSetBody,
  verifyAdminSet,
  type SignedAdminSet,
} from "../src/adminSet";

const GID = "g2-testgroup";

async function setup() {
  const root = await generateAdminKeyPair();
  const deputyA = await generateAdminKeyPair();
  const deputyB = await generateAdminKeyPair();
  return { root, deputyA, deputyB };
}

describe("管理员名单(C-ADM)", () => {
  it("主管理员签的名单能验过;群号、签名、签名人任何一项不对都不行", async () => {
    const { root, deputyA, deputyB } = await setup();
    const body = nextAdminSetBody(GID, undefined, { add: [{ publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" }] }, 1000);
    const signed = await signAdminSet(root.privateKey, root.publicKeyRawB64Url, body);
    expect(await verifyAdminSet(root.publicKeyRawB64Url, GID, signed)).toBe(true);
    expect(await verifyAdminSet(root.publicKeyRawB64Url, "g2-other", signed)).toBe(false);
    // 副管理员自己签的名单不算数
    const forged = await signAdminSet(deputyA.privateKey, root.publicKeyRawB64Url, {
      ...body,
      version: 2,
      deputies: [...body.deputies, { publicKeyRawB64Url: deputyB.publicKeyRawB64Url, label: "B" }],
    });
    expect(await verifyAdminSet(root.publicKeyRawB64Url, GID, forged)).toBe(false);
    // 改正文不改签名
    const tampered: SignedAdminSet = { ...signed, body: { ...signed.body, deputies: [{ publicKeyRawB64Url: deputyB.publicKeyRawB64Url, label: "A" }] } };
    expect(await verifyAdminSet(root.publicKeyRawB64Url, GID, tampered)).toBe(false);
  });

  it("副管理员顺序不影响签名(规范化排序)", async () => {
    const { root, deputyA, deputyB } = await setup();
    const deputies = [
      { publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" },
      { publicKeyRawB64Url: deputyB.publicKeyRawB64Url, label: "B" },
    ];
    const signed = await signAdminSet(root.privateKey, root.publicKeyRawB64Url, { groupId: GID, version: 1, deputies, issuedAtMs: 1 });
    const reordered: SignedAdminSet = { ...signed, body: { ...signed.body, deputies: [...deputies].reverse() } };
    expect(await verifyAdminSet(root.publicKeyRawB64Url, GID, reordered)).toBe(true);
  });

  it("结构检查:主管理员不能写进名单、不能重复、版本从 1 开始、公钥格式要对", async () => {
    const { root, deputyA } = await setup();
    const rk = root.publicKeyRawB64Url;
    const ok = { groupId: GID, version: 1, deputies: [{ publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" }], issuedAtMs: 0 };
    expect(validateAdminSetBody(ok, rk)).toBe(true);
    expect(validateAdminSetBody({ ...ok, deputies: [{ publicKeyRawB64Url: rk, label: "me" }] }, rk)).toBe(false);
    expect(validateAdminSetBody({ ...ok, deputies: [ok.deputies[0], ok.deputies[0]] }, rk)).toBe(false);
    expect(validateAdminSetBody({ ...ok, version: 0 }, rk)).toBe(false);
    expect(validateAdminSetBody({ ...ok, version: 1.5 }, rk)).toBe(false);
    expect(validateAdminSetBody({ ...ok, deputies: [{ publicKeyRawB64Url: "AAAA", label: "x" }] }, rk)).toBe(false);
    await expect(signAdminSet(root.privateKey, rk, { ...ok, version: 0 })).rejects.toThrow();
  });

  it("只接受更新的版本:重放旧名单不能复活被撤销的副管理员", async () => {
    const { root, deputyA } = await setup();
    const rk = root.publicKeyRawB64Url;
    const v1 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, undefined, { add: [{ publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" }] }, 1));
    const v2 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, v1, { remove: [deputyA.publicKeyRawB64Url] }, 2));
    expect(v2.body.version).toBe(2);
    expect(v2.body.deputies).toHaveLength(0);
    expect(await shouldAdoptAdminSet(rk, GID, undefined, v1)).toEqual({ adopt: true });
    expect(await shouldAdoptAdminSet(rk, GID, v1, v2)).toEqual({ adopt: true });
    expect(await shouldAdoptAdminSet(rk, GID, v2, v1)).toEqual({ adopt: false, reason: "not-newer" });
    expect(await shouldAdoptAdminSet(rk, GID, v2, v2)).toEqual({ adopt: false, reason: "not-newer" });
    expect(isActiveAdmin(rk, v2, deputyA.publicKeyRawB64Url)).toBe(false);
    expect(isActiveAdmin(rk, v1, deputyA.publicKeyRawB64Url)).toBe(true);
    expect(isActiveAdmin(rk, v2, rk)).toBe(true);
  });

  it("同版本不同内容 = conflict,保留本机的", async () => {
    const { root, deputyA, deputyB } = await setup();
    const rk = root.publicKeyRawB64Url;
    const a = await signAdminSet(root.privateKey, rk, { groupId: GID, version: 3, deputies: [{ publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" }], issuedAtMs: 1 });
    const b = await signAdminSet(root.privateKey, rk, { groupId: GID, version: 3, deputies: [{ publicKeyRawB64Url: deputyB.publicKeyRawB64Url, label: "B" }], issuedAtMs: 1 });
    expect(await shouldAdoptAdminSet(rk, GID, a, b)).toEqual({ adopt: false, reason: "conflict" });
  });

  it("伪造的名单 → invalid,不论版本号多大", async () => {
    const { root, deputyA } = await setup();
    const rk = root.publicKeyRawB64Url;
    const forged = await signAdminSet(deputyA.privateKey, rk, { groupId: GID, version: 99, deputies: [], issuedAtMs: 1 });
    expect(await shouldAdoptAdminSet(rk, GID, undefined, forged)).toEqual({ adopt: false, reason: "invalid" });
  });

  it("按 keyId 找签名人:没带 keyId 当主管理员(兼容老公告);被撤销的找不到", async () => {
    const { root, deputyA } = await setup();
    const rk = root.publicKeyRawB64Url;
    const v1 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, undefined, { add: [{ publicKeyRawB64Url: deputyA.publicKeyRawB64Url, label: "A" }] }, 1));
    const v2 = await signAdminSet(root.privateKey, rk, nextAdminSetBody(GID, v1, { remove: [deputyA.publicKeyRawB64Url] }, 2));
    const idA = await keyIdOf(deputyA.publicKeyRawB64Url);
    expect(await resolveAdminKey(rk, v1, undefined)).toBe(rk);
    expect(await resolveAdminKey(rk, v1, idA)).toBe(deputyA.publicKeyRawB64Url);
    expect(await resolveAdminKey(rk, v2, idA)).toBeUndefined();
    expect(await resolveAdminKey(rk, v1, "nonsense")).toBeUndefined();
    expect(activeAdminKeys(rk, undefined)).toEqual([rk]);
  });
});
