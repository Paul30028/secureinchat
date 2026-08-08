import { decodeBase64UrlToJson, encodeJsonToBase64Url, isValidBase64Url } from "../base64url";
import { InviteParseError, type BuildInviteInput, type ParsedInvite, type ProtocolAdapter } from "../types";

/**
 * SIC2：正式协议。
 * 格式：`SIC2.<payloadB64Url>`，payload 是 JSON：
 * {
 *   v: 2,
 *   sjc: string;      // serverJoinCode（可轮换，不影响群密钥）
 *   gid: string;      // groupId（稳定的群标识，群密钥派生要用这个当盐值）
 *   km: string;       // keyMaterialB64Url
 *   epoch: number;
 *   exp?: number;     // expiresAtMs
 *   uses?: number;    // remainingUses
 * }
 *
 * 与 SIC1 的关键区别：显式携带 epoch（密钥轮换的版本号）、groupId（和可轮换的
 * serverJoinCode 分开）、可选过期时间和剩余次数，供服务端和客户端双重校验，
 * 而不是只靠服务端单方面判断。
 */
const PREFIX = "SIC2";
const SUPPORTED_PAYLOAD_VERSION = 2;

interface Sic2Payload {
  v: number;
  sjc: string;
  gid: string;
  gn?: string;
  apk?: string;
  km: string;
  epoch: number;
  exp?: number;
  uses?: number;
}

export function parseSic2Invite(raw: string, now: number = Date.now()): ParsedInvite {
  if (!raw || raw.trim().length === 0) {
    throw new InviteParseError("邀请串为空", "empty");
  }
  const trimmed = raw.trim();
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex === -1 || trimmed.slice(0, dotIndex) !== PREFIX) {
    throw new InviteParseError(`不是 SIC2 邀请串（前缀应为 ${PREFIX}）`, "bad-prefix");
  }
  const payloadB64Url = trimmed.slice(dotIndex + 1);
  if (!isValidBase64Url(payloadB64Url)) {
    throw new InviteParseError("SIC2 邀请串载荷编码非法", "invalid-base64url");
  }

  let payload: Sic2Payload;
  try {
    payload = decodeBase64UrlToJson<Sic2Payload>(payloadB64Url);
  } catch {
    throw new InviteParseError("SIC2 邀请串载荷无法解析为 JSON", "invalid-json");
  }

  if (payload.v !== SUPPORTED_PAYLOAD_VERSION) {
    throw new InviteParseError(`不支持的 SIC2 载荷版本：${payload.v}`, "invalid-json");
  }
  if (!payload.sjc || !payload.gid || !isValidBase64Url(payload.km ?? "")) {
    throw new InviteParseError("SIC2 邀请串字段非法", "malformed-segments");
  }
  if (typeof payload.exp === "number" && payload.exp < now) {
    throw new InviteParseError("邀请已过期", "expired");
  }
  if (typeof payload.uses === "number" && payload.uses <= 0) {
    throw new InviteParseError("邀请可用次数已用尽", "exhausted");
  }

  return {
    version: "SIC2",
    isCompatMode: false,
    serverJoinCode: payload.sjc,
    groupId: payload.gid,
    ...(payload.gn !== undefined ? { groupName: payload.gn } : {}),
    ...(payload.apk !== undefined ? { adminPublicKeyRawB64Url: payload.apk } : {}),
    keyMaterialB64Url: payload.km,
    epoch: payload.epoch,
    ...(payload.exp !== undefined ? { expiresAtMs: payload.exp } : {}),
    ...(payload.uses !== undefined ? { remainingUses: payload.uses } : {}),
  };
}

export function buildSic2Invite(input: BuildInviteInput): string {
  const payload: Partial<Sic2Payload> = {
    v: SUPPORTED_PAYLOAD_VERSION,
    sjc: input.serverJoinCode,
    km: input.keyMaterialB64Url,
    epoch: input.epoch ?? 0,
    ...(input.groupId !== undefined ? { gid: input.groupId } : {}),
    ...(input.groupName !== undefined ? { gn: input.groupName } : {}),
    ...(input.adminPublicKeyRawB64Url !== undefined ? { apk: input.adminPublicKeyRawB64Url } : {}),
    ...(input.expiresAtMs !== undefined ? { exp: input.expiresAtMs } : {}),
    ...(input.remainingUses !== undefined ? { uses: input.remainingUses } : {}),
  };
  return `${PREFIX}.${encodeJsonToBase64Url(payload)}`;
}

export const sic2Adapter: ProtocolAdapter = {
  version: "SIC2",
  isCompatMode: false,
  parseInvite: (raw: string) => parseSic2Invite(raw),
  buildInvite: buildSic2Invite,
};
