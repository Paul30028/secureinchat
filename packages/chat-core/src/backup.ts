import {
  decryptAead,
  encryptAead,
  importAeadKeyRaw,
} from "@secureinchat/crypto-core";
import { bytesToBase64Url, base64UrlToBytes } from "./fileTransfer";
import { trimToLimit, type StoredMessage } from "./messageStore";
import { upsertGroup, type JoinedGroup } from "./groupStore";

/**
 * 加密备份到文件 / 从文件恢复。
 *
 * 为什么需要：中继不存消息（盲中继），历史只在本机；换手机或清数据就全没了，
 * 群也要重新要邀请码。备份把「已加入的群 + 消息历史 + 昵称」打成一个加密文件。
 *
 * 刻意不包含：
 * - 设备身份密钥：在系统 Keystore 里，不可导出。恢复后新设备会重新注册。
 * - 管理员私钥：已有「管理员恢复码」这条路。备份里放私钥会扩大泄露面。
 * - 阅后即焚消息：已过期的和仍在倒计时的都不备份——对方期望它会消失，
 *   备份里带过去会绕过这个承诺。
 *
 * 加密：PBKDF2-SHA256 从用户输入的备份密码派生 256 位 AES-GCM 密钥，
 * 16 字节随机盐、12 字节随机 IV。文件格式是 JSON，密文里是 UTF-8 JSON。
 */

const BACKUP_FORMAT = "sic-backup";
const BACKUP_VERSION = 1;
/** 默认 PBKDF2 迭代次数。测试可以调小，实际使用不要改。 */
const DEFAULT_KDF_ITERATIONS = 600_000;
/** 防御性上限：防止被篡改的文件写一个天文数字让恢复卡死。 */
const MAX_KDF_ITERATIONS = 10_000_000;
const SALT_BYTES = 16;
/** 备份密码最短长度，界面也用这个常量。 */
export const MIN_BACKUP_PASSWORD_LENGTH = 10;
/** 固定 AAD：绑定「这段密文属于备份文件 v1」，防止被挪用到别的上下文。 */
const BACKUP_AAD = new TextEncoder().encode("sic-backup:v1");

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

/** 解密后的明文结构。 */
export interface BackupPayload {
  /** 生成备份的时刻 */
  createdAtMs: number;
  /** 备份时的昵称。老备份没有这个字段，恢复时不动本机昵称。 */
  nickname?: string | undefined;
  groups: JoinedGroup[];
  messagesByGroup: Record<string, StoredMessage[]>;
}

/** 磁盘上的文件结构（外层，未加密的元数据 + 密文）。 */
interface BackupFile {
  format: typeof BACKUP_FORMAT;
  v: typeof BACKUP_VERSION;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iter: number;
    salt: string;
  };
  iv: string;
  ct: string;
}

/**
 * 组装要备份的明文。
 *
 * 消息过滤规则：任何带 expiresAtMs 的消息都不进备份。
 * - 已过期（expiresAtMs <= nowMs）：对方期望它已经消失，备份里不该复活。
 * - 计时中（expiresAtMs > nowMs）：对方期望它到点消失，备份里带过去会绕过承诺。
 * 所以不区分两者，一律排除；partitionExpired 只是用来把「已过期」和
 * 「仍在倒计时」分开表达，最终都进不了备份。
 */
export function buildBackupPayload(
  groups: JoinedGroup[],
  messagesByGroup: Record<string, StoredMessage[]>,
  nickname: string | undefined,
  nowMs: number
): BackupPayload {
  const filtered: Record<string, StoredMessage[]> = {};
  for (const [groupId, messages] of Object.entries(messagesByGroup)) {
    filtered[groupId] = messages.filter((m) => m.expiresAtMs === undefined);
  }
  return {
    createdAtMs: nowMs,
    ...(nickname !== undefined ? { nickname } : {}),
    groups,
    messagesByGroup: filtered,
  };
}

async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return importAeadKeyRaw(new Uint8Array(bits));
}

/**
 * 加密成文件文本。返回 JSON 字符串，调用方自己决定怎么下载/存盘。
 * @param iterations 仅供测试调小；默认 600000，实际使用不要改。
 */
export async function encryptBackup(
  payload: BackupPayload,
  password: string,
  iterations: number = DEFAULT_KDF_ITERATIONS
): Promise<string> {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new BackupError(`备份密码至少 ${MIN_BACKUP_PASSWORD_LENGTH} 个字符`);
  }
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > MAX_KDF_ITERATIONS) {
    throw new BackupError("PBKDF2 迭代次数必须是合理的正整数");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKeyFromPassword(password, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    const out = await encryptAead(key, plaintext, BACKUP_AAD);
    iv = out.iv;
    ciphertext = out.ciphertext;
  } catch (err) {
    throw new BackupError(`加密失败：${err instanceof Error ? err.message : "请重试"}`);
  }

  const file: BackupFile = {
    format: BACKUP_FORMAT,
    v: BACKUP_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iter: iterations,
      salt: bytesToBase64Url(salt),
    },
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(ciphertext),
  };
  return JSON.stringify(file);
}

/**
 * 解密备份文件文本。
 *
 * 错误分两类：
 * - 格式不对（不是 JSON、format/v 不匹配、kdf 字段缺失或非法）：抛具体的
 *   BackupError，方便排查「这不是本应用的备份文件」。
 * - 解密失败（密码错或文件被改）：统一抛「密码不对，或文件已损坏」，
 *   不区分原因——AES-GCM 认证失败时本来也区分不了。
 */
export async function decryptBackup(text: string, password: string): Promise<BackupPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("备份文件不是合法 JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new BackupError("备份文件格式不对");
  }
  const file = parsed as Partial<BackupFile>;
  if (file.format !== BACKUP_FORMAT || file.v !== BACKUP_VERSION) {
    throw new BackupError("备份文件格式不对");
  }
  const kdf = file.kdf;
  if (
    typeof kdf !== "object" ||
    kdf === null ||
    kdf.name !== "PBKDF2" ||
    kdf.hash !== "SHA-256" ||
    typeof kdf.iter !== "number" ||
    !Number.isInteger(kdf.iter) ||
    kdf.iter <= 0 ||
    kdf.iter > MAX_KDF_ITERATIONS ||
    typeof kdf.salt !== "string"
  ) {
    throw new BackupError("备份文件的密钥派生参数不对");
  }
  if (typeof file.iv !== "string" || typeof file.ct !== "string") {
    throw new BackupError("备份文件内容不完整");
  }

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = base64UrlToBytes(kdf.salt);
    iv = base64UrlToBytes(file.iv);
    ciphertext = base64UrlToBytes(file.ct);
  } catch {
    throw new BackupError("备份文件内容不是合法的 base64url");
  }
  if (salt.byteLength === 0 || iv.byteLength === 0 || ciphertext.byteLength === 0) {
    throw new BackupError("备份文件内容不完整");
  }

  let plaintext: Uint8Array;
  try {
    const key = await deriveKeyFromPassword(password, salt, kdf.iter);
    plaintext = await decryptAead(key, { iv, ciphertext }, BACKUP_AAD);
  } catch {
    // 不区分「密码错」和「文件被改」——统一提示，避免给攻击者侧信道信息
    throw new BackupError("密码不对，或文件已损坏");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new BackupError("备份内容不是合法 JSON");
  }
  if (!isBackupPayload(payload)) {
    throw new BackupError("备份内容格式不对");
  }
  return payload;
}

function isBackupPayload(v: unknown): v is BackupPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Partial<BackupPayload>;
  if (typeof p.createdAtMs !== "number" || !Number.isFinite(p.createdAtMs)) return false;
  if (!Array.isArray(p.groups)) return false;
  if (typeof p.messagesByGroup !== "object" || p.messagesByGroup === null) return false;
  return true;
}

export interface MergeRestoreResult {
  groups: JoinedGroup[];
  messagesByGroup: Record<string, StoredMessage[]>;
  /** 本次新添加的群（本机原来没有） */
  addedGroupIds: string[];
  /** 备份里有、但本机已有而保持不动的群 */
  skippedGroupIds: string[];
  /** 写入新群的消息条数（去重、截断之后） */
  addedMessages: number;
}

function isRestorableGroup(v: unknown): v is JoinedGroup {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Partial<JoinedGroup>;
  return (
    typeof g.groupId === "string" &&
    g.groupId.length > 0 &&
    typeof g.groupName === "string" &&
    typeof g.keyMaterialB64Url === "string" &&
    g.keyMaterialB64Url.length > 0 &&
    typeof g.epoch === "number" &&
    Number.isInteger(g.epoch) &&
    g.epoch >= 0 &&
    typeof g.joinedAtMs === "number" &&
    typeof g.lastReadAtMs === "number"
  );
}

function isRestorableMessage(v: unknown): v is StoredMessage {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Partial<StoredMessage>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.sentAtMs === "number" &&
    Number.isFinite(m.sentAtMs) &&
    // Disappearing messages are never restored, even from a hand-edited file.
    m.expiresAtMs === undefined
  );
}

/**
 * 把备份合并到本机现有数据。
 *
 * 规则只有一条：**本机已有的群完全不动**（群设置和消息都不动），只添加本机没有的群和它们的消息。
 * - 群：备份可能是旧的，里面的密钥材料和 epoch 也是旧的。用它覆盖会把群退回旧 epoch——
 *   这正是「epoch 不高于当前的邀请码一律忽略」要防的降级。
 * - 消息：已连接的群，消息列表在内存会话里，每次保存都整体写回存储；往存储里补旧消息会在
 *   下一次保存时被覆盖掉。只给新添加的群写消息，就不会出现「恢复了又丢了」。
 * - 结构不合法的群和消息丢弃；带倒计时的消息即使出现在手改过的文件里也丢弃。
 * 新群的消息按 id 去重、按 sentAtMs 排序，再用 trimToLimit 截断到上限。
 */
export function mergeRestore(
  existingGroups: JoinedGroup[],
  existingMessagesByGroup: Record<string, StoredMessage[]>,
  payload: BackupPayload
): MergeRestoreResult {
  const localIds = new Set(existingGroups.map((g) => g.groupId));
  let groups = existingGroups;
  const added: string[] = [];
  const skipped: string[] = [];
  for (const g of payload.groups as unknown[]) {
    if (!isRestorableGroup(g)) continue;
    if (localIds.has(g.groupId)) {
      if (!skipped.includes(g.groupId)) skipped.push(g.groupId);
      continue;
    }
    if (added.includes(g.groupId)) continue;
    groups = upsertGroup(groups, g);
    added.push(g.groupId);
  }

  const messagesByGroup: Record<string, StoredMessage[]> = { ...existingMessagesByGroup };
  let addedMessages = 0;
  for (const groupId of added) {
    const incoming = payload.messagesByGroup[groupId];
    if (!Array.isArray(incoming)) continue;
    const byId = new Map<string, StoredMessage>();
    for (const m of incoming as unknown[]) {
      if (isRestorableMessage(m) && !byId.has(m.id)) byId.set(m.id, m);
    }
    const merged = trimToLimit([...byId.values()].sort((a, b) => a.sentAtMs - b.sentAtMs));
    messagesByGroup[groupId] = merged;
    addedMessages += merged.length;
  }

  return { groups, messagesByGroup, addedGroupIds: added, skippedGroupIds: skipped, addedMessages };
}
