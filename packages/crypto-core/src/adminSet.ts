/**
 * 多管理员(C-ADM,设计稿 docs/protocol/ADMIN_ROSTER_DESIGN.md 第 3 节)。
 *
 * ⚠️ 状态:核心逻辑 + 单元测试,**没有接进 App 和中继**,等 Paul 审查设计。
 *
 * 模型:建群时那把管理员密钥(邀请串里的 `apk`)是「主管理员」,永远有效、不能被撤销。
 * 主管理员可以签一份「管理员名单」,把别的公钥加为「副管理员」;要撤销某人,就签一份
 * 版本号更大、不含他的新名单。只有主管理员能改名单——这样不会出现两个副管理员互相
 * 撤销、各执一份名单的分叉,代价是主管理员的恢复码丢了就再也改不了名单(和今天一样)。
 *
 * 名单在群里以加密消息传播(中继看不到),谁转发都行:真假只看主管理员签名。
 * 客户端只接受版本号更大的名单,所以重放旧名单不能把被撤销的人「复活」。
 */

import { isP256PublicKeyB64Url, keyIdOf, sha256B64Url, signP256, verifyP256 } from "./b64url";

export const MAX_DEPUTY_ADMINS = 16;
const ADMIN_SET_DOMAIN = "secureinchat:admin-set:v1\n";
const LABEL_MAX = 64;

export interface DeputyAdmin {
  publicKeyRawB64Url: string;
  /** 主管理员给这个人起的称呼,只用于显示 */
  label: string;
}

export interface AdminSetBody {
  groupId: string;
  /** 从 1 开始,每次修改加一 */
  version: number;
  /** 副管理员,不含主管理员本人 */
  deputies: DeputyAdmin[];
  issuedAtMs: number;
}

export interface SignedAdminSet {
  body: AdminSetBody;
  /** 主管理员对 adminSetSigningInput(body) 的 P1363 签名 */
  signature: string;
}

export class AdminSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSetError";
  }
}

function isSafeInt(n: unknown, min: number): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= min;
}

/** 结构检查。不合格的名单连签名都不必验。 */
export function validateAdminSetBody(body: unknown, rootPublicKeyRawB64Url: string): body is AdminSetBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<AdminSetBody>;
  if (typeof b.groupId !== "string" || b.groupId.length === 0) return false;
  if (!isSafeInt(b.version, 1) || !isSafeInt(b.issuedAtMs, 0)) return false;
  if (!Array.isArray(b.deputies) || b.deputies.length > MAX_DEPUTY_ADMINS) return false;
  const seen = new Set<string>();
  for (const d of b.deputies) {
    if (!d || typeof d !== "object") return false;
    if (!isP256PublicKeyB64Url(d.publicKeyRawB64Url)) return false;
    if (typeof d.label !== "string" || d.label.length > LABEL_MAX) return false;
    // 主管理员是隐含的,写进名单只会让「撤销」的含义变模糊
    if (d.publicKeyRawB64Url === rootPublicKeyRawB64Url) return false;
    if (seen.has(d.publicKeyRawB64Url)) return false;
    seen.add(d.publicKeyRawB64Url);
  }
  return true;
}

/**
 * 被签名的字节。副管理员按公钥排序后再序列化,所以同一份名单不管数组顺序如何
 * 签出来的输入都一样。groupId 在内:A 群的名单不能搬到 B 群。
 */
export function adminSetSigningInput(body: AdminSetBody): Uint8Array {
  const deputies = [...body.deputies]
    .sort((a, b) => (a.publicKeyRawB64Url < b.publicKeyRawB64Url ? -1 : a.publicKeyRawB64Url > b.publicKeyRawB64Url ? 1 : 0))
    .map((d) => [d.publicKeyRawB64Url, d.label]);
  return new TextEncoder().encode(
    ADMIN_SET_DOMAIN + JSON.stringify([body.groupId, body.version, deputies, body.issuedAtMs])
  );
}

export async function signAdminSet(
  rootPrivateKey: CryptoKey,
  rootPublicKeyRawB64Url: string,
  body: AdminSetBody
): Promise<SignedAdminSet> {
  if (!validateAdminSetBody(body, rootPublicKeyRawB64Url)) {
    throw new AdminSetError("管理员名单格式不正确");
  }
  return { body, signature: await signP256(rootPrivateKey, adminSetSigningInput(body)) };
}

/** 结构合格、群号对得上、主管理员签名有效,才返回 true。不抛错。 */
export async function verifyAdminSet(
  rootPublicKeyRawB64Url: string,
  groupId: string,
  signed: SignedAdminSet
): Promise<boolean> {
  if (!signed || typeof signed !== "object" || typeof signed.signature !== "string") return false;
  if (!validateAdminSetBody(signed.body, rootPublicKeyRawB64Url)) return false;
  if (signed.body.groupId !== groupId) return false;
  return verifyP256(rootPublicKeyRawB64Url, signed.signature, adminSetSigningInput(signed.body));
}

export type AdoptAdminSetResult =
  | { adopt: true }
  | { adopt: false; reason: "invalid" | "not-newer" | "conflict" };

/**
 * 收到一份名单时要不要换成它。
 * - 验不过 → invalid
 * - 版本号不大于本机的 → not-newer(防回滚:旧名单里还有被撤销的人)
 * - 同版本但内容不同 → conflict:主管理员签了两份同号名单(只可能是恢复码在两台设备上
 *   同时用,或者泄露了)。保留本机的,界面应提示主管理员。
 */
export async function shouldAdoptAdminSet(
  rootPublicKeyRawB64Url: string,
  groupId: string,
  current: SignedAdminSet | undefined,
  incoming: SignedAdminSet
): Promise<AdoptAdminSetResult> {
  if (!(await verifyAdminSet(rootPublicKeyRawB64Url, groupId, incoming))) return { adopt: false, reason: "invalid" };
  if (!current) return { adopt: true };
  if (incoming.body.version > current.body.version) return { adopt: true };
  if (incoming.body.version === current.body.version) {
    const a = await sha256B64Url(adminSetSigningInput(current.body));
    const b = await sha256B64Url(adminSetSigningInput(incoming.body));
    if (a !== b) return { adopt: false, reason: "conflict" };
  }
  return { adopt: false, reason: "not-newer" };
}

/** 当前有效的全部管理员公钥:主管理员在第一个。 */
export function activeAdminKeys(rootPublicKeyRawB64Url: string, set: SignedAdminSet | undefined): string[] {
  return [rootPublicKeyRawB64Url, ...(set?.body.deputies.map((d) => d.publicKeyRawB64Url) ?? [])];
}

/** 公钥 → 是否是当前管理员(主或副) */
export function isActiveAdmin(
  rootPublicKeyRawB64Url: string,
  set: SignedAdminSet | undefined,
  publicKeyRawB64Url: string
): boolean {
  return activeAdminKeys(rootPublicKeyRawB64Url, set).includes(publicKeyRawB64Url);
}

/**
 * 按 keyId 找当前有效的管理员公钥。没带 keyId(老客户端发的公告)= 主管理员。
 * 找不到(被撤销或伪造)返回 undefined。
 */
export async function resolveAdminKey(
  rootPublicKeyRawB64Url: string,
  set: SignedAdminSet | undefined,
  signerKeyId: string | undefined
): Promise<string | undefined> {
  const keys = activeAdminKeys(rootPublicKeyRawB64Url, set);
  if (signerKeyId === undefined) return rootPublicKeyRawB64Url;
  for (const k of keys) {
    if ((await keyIdOf(k)) === signerKeyId) return k;
  }
  return undefined;
}

/** 生成下一版名单的正文(不签名)。加和删都用它,版本号自动加一。 */
export function nextAdminSetBody(
  groupId: string,
  current: SignedAdminSet | undefined,
  change: { add?: DeputyAdmin[]; remove?: string[] },
  nowMs: number
): AdminSetBody {
  const removed = new Set(change.remove ?? []);
  const kept = (current?.body.deputies ?? []).filter((d) => !removed.has(d.publicKeyRawB64Url));
  const keptKeys = new Set(kept.map((d) => d.publicKeyRawB64Url));
  const added = (change.add ?? []).filter((d) => !keptKeys.has(d.publicKeyRawB64Url) && !removed.has(d.publicKeyRawB64Url));
  return {
    groupId,
    version: (current?.body.version ?? 0) + 1,
    deputies: [...kept, ...added],
    issuedAtMs: nowMs,
  };
}

/** 公钥格式检查和 keyId 计算,供 App 和名单模块使用 */
export { isP256PublicKeyB64Url, keyIdOf };
