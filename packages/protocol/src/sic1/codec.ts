import { isValidBase64Url } from "../base64url";
import { InviteParseError, type BuildInviteInput, type ParsedInvite, type ProtocolAdapter } from "../types";

/**
 * SIC1：兼容旧仓库（secure-invite-chat）的邀请串格式。
 * 格式：`SIC1.<serverJoinCode>.<keyMaterialB64Url>`
 *
 * 仅用于旧成员迁移期。这里刻意不实现 epoch / 过期时间 / 次数限制——
 * 旧协议本来就没有这些字段，绝不通过"假装支持"来虚报安全等级。
 * UI 层看到 `isCompatMode === true` 必须显示"兼容模式"标记。
 */
const PREFIX = "SIC1";

export function parseSic1Invite(raw: string): ParsedInvite {
  if (!raw || raw.trim().length === 0) {
    throw new InviteParseError("邀请串为空", "empty");
  }
  const parts = raw.trim().split(".");
  if (parts[0] !== PREFIX) {
    throw new InviteParseError(`不是 SIC1 邀请串（前缀应为 ${PREFIX}）`, "bad-prefix");
  }
  if (parts.length !== 3) {
    throw new InviteParseError("SIC1 邀请串格式错误，应为 SIC1.<入群码>.<密钥材料>", "malformed-segments");
  }
  const [, serverJoinCode, keyMaterialB64Url] = parts;
  if (!serverJoinCode || !isValidBase64Url(keyMaterialB64Url ?? "")) {
    throw new InviteParseError("SIC1 邀请串段落非法", "invalid-base64url");
  }
  return {
    version: "SIC1",
    isCompatMode: true,
    serverJoinCode,
    keyMaterialB64Url: keyMaterialB64Url as string,
  };
}

export function buildSic1Invite(input: BuildInviteInput): string {
  return `${PREFIX}.${input.serverJoinCode}.${input.keyMaterialB64Url}`;
}

export const sic1Adapter: ProtocolAdapter = {
  version: "SIC1",
  isCompatMode: true,
  parseInvite: parseSic1Invite,
  buildInvite: buildSic1Invite,
};
