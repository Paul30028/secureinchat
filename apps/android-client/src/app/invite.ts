/**
 * 邀请相关的小工具（从 App.tsx 拆出，K6）。
 */
import type { InviteParseError, ParsedInvite } from "@secureinchat/protocol";
import type { JoinedGroup } from "@secureinchat/chat-core";
import { t } from "../i18n";

/** 把过期时间戳转成"有效期剩 X 天 Y 小时"这种人话 */
export function formatExpiry(expiresAtMs: number, now: number = Date.now()): string {
  const remainMs = expiresAtMs - now;
  if (remainMs <= 0) return t("invite.expired");
  const hours = Math.floor(remainMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return t("invite.expiresInDaysHours", { days, hours: hours % 24 });
  if (hours > 0) return t("invite.expiresInHours", { count: hours });
  return t("invite.expiresInMinutes", { count: Math.max(1, Math.floor(remainMs / 60_000)) });
}

/**
 * protocol 包解析出的 InviteParseError.reason 和 ui 包 InviteInfoCard 期待的
 * reason 不是同一套枚举——前者是"哪里解析失败"（bad-prefix/invalid-json 等，
 * 面向协议实现者），后者是"给用户看的失效原因"（面向最终用户）。这里做一次
 * 明确的映射，不要把协议层的内部错误码直接展示给用户。
 */
export function mapParseErrorReason(reason: InviteParseError["reason"]): "expired" | "exhausted" | "malformed" {
  if (reason === "expired") return "expired";
  if (reason === "exhausted") return "exhausted";
  return "malformed";
}

/**
 * 本机记住的群 → 重连用的 ParsedInvite。启动自动重连和备份恢复后重连都用它，
 * 之前两处各写了一份。
 */
export function parsedInviteFor(g: JoinedGroup): ParsedInvite {
  return {
    version: "SIC2",
    isCompatMode: false,
    serverJoinCode: "",
    groupId: g.groupId,
    keyMaterialB64Url: g.keyMaterialB64Url,
    epoch: g.epoch,
    ...(g.adminPublicKeyRawB64Url ? { adminPublicKeyRawB64Url: g.adminPublicKeyRawB64Url } : {}),
  };
}
