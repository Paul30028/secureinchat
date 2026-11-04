/**
 * 管理员签名的设备名单(C-ROSTER,设计稿 docs/protocol/ADMIN_ROSTER_DESIGN.md 第 4–5 节)。
 *
 * ⚠️ 状态:核心逻辑 + 单元测试,**没有接进 App**,等 Paul 审查设计。
 *
 * 要回答的问题是「群里这台设备是不是管理员认可的」,而且要**自动**回答——不让用户
 * 互相核对一串数字(Paul 否决了安全码)。做法:
 *
 * 1. 新设备入群后,用自己的设备私钥签一份「入群申请」(deviceId + 设备公钥 + 昵称),
 *    在群里加密广播。
 * 2. 管理员的 App 收到后自动判断:如果申请里带的「邀请标记」对得上管理员发出的某张
 *    一人一码的邀请,而且这张邀请还没被别的设备用过 → 自动批准;其他情况列给管理员手动决定。
 * 3. 批准 = 管理员签一份版本号更大的设备名单(deviceId ↔ 设备公钥 ↔ 昵称)。
 * 4. 每个成员的 App 拿名单对照自己看到的设备,不在名单里的自动标出来。
 *
 * 名单和申请都走加密消息,中继看不到,也不需要中继改动。
 */

import { activeAdminKeys, type SignedAdminSet } from "./adminSet";
import { fromB64Url, isP256PublicKeyB64Url, sha256B64Url, signP256, toB64Url, verifyP256 } from "./b64url";

export const MAX_ROSTER_DEVICES = 256;
const NAME_MAX = 64;
const ROSTER_DOMAIN = "secureinchat:device-roster:v1\n";
const JOIN_DOMAIN = "secureinchat:join-request:v1\n";
const INVITE_TAG_DOMAIN = "secureinchat:invite-tag:v1\n";

// ---------- 设备名单 ----------

export interface RosterEntry {
  deviceId: string;
  devicePublicKeyRawB64Url: string;
  name: string;
  approvedAtMs: number;
}

export interface RosterBody {
  groupId: string;
  version: number;
  /** 签发时依据的管理员名单版本(0 = 还没有副管理员名单) */
  adminSetVersion: number;
  entries: RosterEntry[];
  issuedAtMs: number;
}

export interface SignedRoster {
  body: RosterBody;
  signerPublicKeyRawB64Url: string;
  signature: string;
}

function isSafeInt(n: unknown, min: number): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n >= min;
}

export function validateRosterBody(body: unknown): body is RosterBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<RosterBody>;
  if (typeof b.groupId !== "string" || b.groupId.length === 0) return false;
  if (!isSafeInt(b.version, 1) || !isSafeInt(b.adminSetVersion, 0) || !isSafeInt(b.issuedAtMs, 0)) return false;
  if (!Array.isArray(b.entries) || b.entries.length > MAX_ROSTER_DEVICES) return false;
  const ids = new Set<string>();
  for (const e of b.entries) {
    if (!e || typeof e !== "object") return false;
    if (typeof e.deviceId !== "string" || e.deviceId.length === 0 || e.deviceId.length > 128) return false;
    if (!isP256PublicKeyB64Url(e.devicePublicKeyRawB64Url)) return false;
    if (typeof e.name !== "string" || e.name.length > NAME_MAX) return false;
    if (!isSafeInt(e.approvedAtMs, 0)) return false;
    if (ids.has(e.deviceId)) return false;
    ids.add(e.deviceId);
  }
  return true;
}

export function rosterSigningInput(body: RosterBody): Uint8Array {
  const entries = [...body.entries]
    .sort((a, b) => (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0))
    .map((e) => [e.deviceId, e.devicePublicKeyRawB64Url, e.name, e.approvedAtMs]);
  return new TextEncoder().encode(
    ROSTER_DOMAIN + JSON.stringify([body.groupId, body.version, body.adminSetVersion, entries, body.issuedAtMs])
  );
}

export async function signRoster(
  adminPrivateKey: CryptoKey,
  adminPublicKeyRawB64Url: string,
  body: RosterBody
): Promise<SignedRoster> {
  if (!validateRosterBody(body)) throw new Error("设备名单格式不正确");
  return {
    body,
    signerPublicKeyRawB64Url: adminPublicKeyRawB64Url,
    signature: await signP256(adminPrivateKey, rosterSigningInput(body)),
  };
}

/**
 * 名单有效 = 结构合格、群号对、签名人是**当前**有效的管理员、签名对。
 * 签名人一旦被撤销,他签过的名单也随之失效——客户端应等下一份有效名单
 * (设计稿 4.3:主管理员撤销副管理员时同时重签名单)。
 */
export async function verifyRoster(
  rootPublicKeyRawB64Url: string,
  adminSet: SignedAdminSet | undefined,
  groupId: string,
  signed: SignedRoster
): Promise<boolean> {
  if (!signed || typeof signed !== "object") return false;
  if (typeof signed.signature !== "string" || typeof signed.signerPublicKeyRawB64Url !== "string") return false;
  if (!validateRosterBody(signed.body) || signed.body.groupId !== groupId) return false;
  if (!activeAdminKeys(rootPublicKeyRawB64Url, adminSet).includes(signed.signerPublicKeyRawB64Url)) return false;
  // 不能引用本机还没见过的管理员名单版本:否则说明本机名单落后,先去同步名单
  if (signed.body.adminSetVersion > (adminSet?.body.version ?? 0)) return false;
  return verifyP256(signed.signerPublicKeyRawB64Url, signed.signature, rosterSigningInput(signed.body));
}

export type AdoptRosterResult = { adopt: true } | { adopt: false; reason: "invalid" | "not-newer" };

/**
 * 版本号大的胜出。同版本内容不同(两个管理员同时批准了不同的人)时,
 * 取正文哈希较小的那份——所有客户端算出来一样,自然收敛;落选那位管理员的 App
 * 发现自己批准的设备不在名单里,应在新版本上重签一次(见 nextRosterBody)。
 */
export async function shouldAdoptRoster(
  rootPublicKeyRawB64Url: string,
  adminSet: SignedAdminSet | undefined,
  groupId: string,
  current: SignedRoster | undefined,
  incoming: SignedRoster
): Promise<AdoptRosterResult> {
  if (!(await verifyRoster(rootPublicKeyRawB64Url, adminSet, groupId, incoming))) return { adopt: false, reason: "invalid" };
  if (!current) return { adopt: true };
  if (incoming.body.version > current.body.version) return { adopt: true };
  if (incoming.body.version === current.body.version) {
    const a = await sha256B64Url(rosterSigningInput(current.body));
    const b = await sha256B64Url(rosterSigningInput(incoming.body));
    if (b < a) return { adopt: true };
  }
  return { adopt: false, reason: "not-newer" };
}

export function nextRosterBody(
  groupId: string,
  current: RosterBody | undefined,
  adminSetVersion: number,
  change: { add?: RosterEntry[]; removeDeviceIds?: string[] },
  nowMs: number
): RosterBody {
  const removed = new Set(change.removeDeviceIds ?? []);
  const adds = new Map((change.add ?? []).map((e) => [e.deviceId, e]));
  const kept = (current?.entries ?? []).filter((e) => !removed.has(e.deviceId) && !adds.has(e.deviceId));
  return {
    groupId,
    version: (current?.version ?? 0) + 1,
    adminSetVersion,
    entries: [...kept, ...[...adds.values()].filter((e) => !removed.has(e.deviceId))],
    issuedAtMs: nowMs,
  };
}

// ---------- 自动对照 ----------

export interface DeviceCheck {
  /** 在名单里,而且(如果知道公钥)公钥一致 */
  listed: { deviceId: string; name: string }[];
  /** 看到了但名单里没有 */
  unlisted: string[];
  /** deviceId 在名单里,但看到的公钥和名单不同——比「不在名单」更可疑 */
  keyMismatch: string[];
}

/**
 * 拿名单对照本机看到的设备。observed 的公钥可选:
 * 中继转发帧只带 fromDeviceId,公钥要等入群申请或(第二阶段)消息签名才知道。
 */
export function checkObservedDevices(
  roster: RosterBody | undefined,
  observed: { deviceId: string; devicePublicKeyRawB64Url?: string | undefined }[]
): DeviceCheck {
  const byId = new Map((roster?.entries ?? []).map((e) => [e.deviceId, e]));
  const out: DeviceCheck = { listed: [], unlisted: [], keyMismatch: [] };
  for (const o of observed) {
    const e = byId.get(o.deviceId);
    if (!e) out.unlisted.push(o.deviceId);
    else if (o.devicePublicKeyRawB64Url !== undefined && o.devicePublicKeyRawB64Url !== e.devicePublicKeyRawB64Url)
      out.keyMismatch.push(o.deviceId);
    else out.listed.push({ deviceId: e.deviceId, name: e.name });
  }
  return out;
}

// ---------- 入群申请与一人一码 ----------

export interface JoinRequestBody {
  groupId: string;
  deviceId: string;
  devicePublicKeyRawB64Url: string;
  name: string;
  /** 一人一码邀请时带上;普通邀请没有 */
  inviteTag?: string | undefined;
  requestedAtMs: number;
}

export interface SignedJoinRequest {
  body: JoinRequestBody;
  /** 设备私钥(KeystorePort.sign)对 joinRequestSigningInput 的 P1363 签名 */
  signature: string;
}

export function joinRequestSigningInput(body: JoinRequestBody): Uint8Array {
  return new TextEncoder().encode(
    JOIN_DOMAIN +
      JSON.stringify([body.groupId, body.deviceId, body.devicePublicKeyRawB64Url, body.name, body.inviteTag ?? "", body.requestedAtMs])
  );
}

/** 设备端:用 KeystorePort 签(私钥不出 Keystore)。sign 回调返回 P1363 字节。 */
export async function signJoinRequest(
  sign: (data: Uint8Array) => Promise<Uint8Array>,
  body: JoinRequestBody
): Promise<SignedJoinRequest> {
  const sig = await sign(joinRequestSigningInput(body));
  return { body, signature: toB64Url(sig) };
}

/** 自签名:证明申请人持有这把设备私钥(和中继注册的是同一把,见设计稿 4.2) */
export async function verifyJoinRequest(groupId: string, req: SignedJoinRequest): Promise<boolean> {
  if (!req || typeof req !== "object" || !req.body || typeof req.signature !== "string") return false;
  const b = req.body;
  if (b.groupId !== groupId) return false;
  if (typeof b.deviceId !== "string" || b.deviceId.length === 0 || b.deviceId.length > 128) return false;
  if (!isP256PublicKeyB64Url(b.devicePublicKeyRawB64Url)) return false;
  if (typeof b.name !== "string" || b.name.length > NAME_MAX) return false;
  if (b.inviteTag !== undefined && typeof b.inviteTag !== "string") return false;
  if (!isSafeInt(b.requestedAtMs, 0)) return false;
  return verifyP256(b.devicePublicKeyRawB64Url, req.signature, joinRequestSigningInput(b));
}

/** 一人一码邀请的秘密:32 字节随机数,放进那一张邀请串(SIC2 新字段 `ivs`)。 */
export function generateInviteSecret(): string {
  return toB64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * 邀请标记 = HMAC(邀请秘密, 群号 + deviceId + 设备公钥)。
 * 绑定设备:群里别的成员看到这个标记,也不能拿去替自己的设备申请;
 * 没有那张邀请的人算不出来。
 */
export async function computeInviteTag(
  inviteSecretB64Url: string,
  groupId: string,
  deviceId: string,
  devicePublicKeyRawB64Url: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    fromB64Url(inviteSecretB64Url) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = new TextEncoder().encode(
    INVITE_TAG_DOMAIN + JSON.stringify([groupId, deviceId, devicePublicKeyRawB64Url])
  );
  return toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, data as BufferSource)));
}

/** 管理员本机记录的一人一码邀请(只存在管理员的加密存储里,不广播) */
export interface IssuedInvite {
  inviteSecretB64Url: string;
  /** 管理员写的备注,例如「给张三」;自动批准时作为默认昵称来源 */
  note: string;
  /** 已经被哪台设备用掉;undefined = 还没用 */
  usedByDeviceId?: string | undefined;
}

export type JoinDecision =
  | { action: "reject"; reason: "bad-signature" }
  | { action: "already-listed" }
  | { action: "auto-approve"; inviteIndex: number }
  | { action: "manual"; reason: "no-invite-tag" | "unknown-invite" | "invite-already-used" | "device-key-changed" };

/**
 * 管理员 App 对一份入群申请的自动判断。只有一种情况自动批准:
 * 申请签名有效 + 邀请标记对得上一张还没被用过的一人一码邀请 + 这个 deviceId 不在名单里。
 * 别的都交给管理员手动决定,不自动拒绝(普通邀请入群的人仍然可以被批准)。
 */
export async function decideJoinRequest(
  groupId: string,
  req: SignedJoinRequest,
  roster: RosterBody | undefined,
  invites: IssuedInvite[]
): Promise<JoinDecision> {
  if (!(await verifyJoinRequest(groupId, req))) return { action: "reject", reason: "bad-signature" };
  const b = req.body;
  const existing = roster?.entries.find((e) => e.deviceId === b.deviceId);
  if (existing) {
    if (existing.devicePublicKeyRawB64Url === b.devicePublicKeyRawB64Url) return { action: "already-listed" };
    return { action: "manual", reason: "device-key-changed" };
  }
  if (!b.inviteTag) return { action: "manual", reason: "no-invite-tag" };
  for (let i = 0; i < invites.length; i++) {
    const inv = invites[i]!;
    const expected = await computeInviteTag(inv.inviteSecretB64Url, groupId, b.deviceId, b.devicePublicKeyRawB64Url);
    if (!timingSafeEqualStr(expected, b.inviteTag)) continue;
    // 用过一次就不再自动批准——包括同一台设备:它可能是被移出后又拿旧邀请回来申请
    if (inv.usedByDeviceId !== undefined) return { action: "manual", reason: "invite-already-used" };
    return { action: "auto-approve", inviteIndex: i };
  }
  return { action: "manual", reason: "unknown-invite" };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
