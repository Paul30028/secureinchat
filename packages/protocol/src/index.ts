export * from "./types";
export { parseSic1Invite, buildSic1Invite, sic1Adapter } from "./sic1/codec";
export { parseSic2Invite, buildSic2Invite, sic2Adapter } from "./sic2/codec";

import { InviteParseError, type ParsedInvite } from "./types";
import { parseSic1Invite } from "./sic1/codec";
import { parseSic2Invite } from "./sic2/codec";

/**
 * 根据前缀自动选择 SIC1 或 SIC2 解析器。这是唯一允许出现"看前缀分支"的地方——
 * UI 组件本身不应该做这个判断，而是调用这一个函数拿到统一的 ParsedInvite。
 */
export function parseInviteAuto(raw: string): ParsedInvite {
  const trimmed = raw.trim();
  if (trimmed.startsWith("SIC2.")) return parseSic2Invite(trimmed);
  if (trimmed.startsWith("SIC1.")) return parseSic1Invite(trimmed);
  throw new InviteParseError("无法识别的邀请串前缀", "bad-prefix");
}
