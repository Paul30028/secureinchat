import { useState } from "react";
import { colors, MessageListItem, BottomNav, Button, touchTarget, type BottomNavKey } from "@secureinchat/ui";
import { TodayScreen, type TodayContent } from "./TodayScreen";
import { registerTap, INITIAL_TAP_STATE, type TapState } from "../adminAccess";
import { formatListTime } from "../timeFormat";
import { APP_VERSION } from "../version";
import { LanguageSetting } from "./LanguageSetting";
import type { MasterKeyProtection } from "@secureinchat/secure-storage";
import { t } from "../i18n";

export interface GroupListItem {
  groupId: string;
  groupName: string;
  unread: number;
  onlineCount: number;
  lastMessage?: { preview: string; sentAtMs: number } | undefined;
}

/**
 * C10-A：如实说明本机数据受什么保护、不防什么。不往高里说。
 * API 31 以下系统分不出 StrongBox 和 TEE，都报 tee（只会少说，不会多说）。
 */
export function protectionText(p: MasterKeyProtection): string {
  const limit = t("protection.limit");
  if (p === "strongbox") {
    return t("protection.withLimit", { text: t("protection.strongbox"), limit });
  }
  if (p === "tee") {
    return t("protection.withLimit", { text: t("protection.tee"), limit });
  }
  if (p === "software") {
    return t("protection.withLimit", { text: t("protection.software"), limit });
  }
  return t("protection.webview");
}

export interface MessageListScreenProps {
  groups: GroupListItem[];
  onOpenGroup: (groupId: string) => void;
  /** 长按群条目触发——直接到群设置，退群/改名都在那儿 */
  onOpenGroupSettings: (groupId: string) => void;
  /** 去加入/创建另一个群 */
  onJoinAnotherGroup: () => void;
  todayContent: TodayContent;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  /** 版本号连点 7 次后触发 */
  onAdminUnlocked: () => void;
  onOpenAdminRecovery: () => void;
  onOpenLockSetup: () => void;
  onOpenDiagnostics: () => void;
  onOpenDevices: () => void;
  onOpenEditProfile: () => void;
  deviceId: string;
  nickname?: string | undefined;
  onOpenServerSettings: () => void;
  relayUrl: string;
  /** 默认打开哪个 tab，不传就是公告 */
  initialTab?: BottomNavKey | undefined;
  /** 截屏保护是否开启 */
  screenSecurityEnabled?: boolean | undefined;
  /** 点按「截屏保护」开关。不传（Web 端没有这个系统能力）就不显示这一行——不放点了没用的开关 */
  onToggleScreenSecurity?: (() => void) | undefined;
  /** 指纹/面部解锁是否开启 */
  biometricEnabled?: boolean | undefined;
  /** 点按「用指纹或面部解锁」开关。不传（平台不支持）就不显示这一行 */
  onToggleBiometric?: (() => void) | undefined;
  /** 应用锁是否已启用。未启用时点按生物识别行会引导去设置应用密码 */
  lockEnabled?: boolean | undefined;
  /** 打开「备份与恢复」页面。不传就不显示这一行 */
  onOpenBackup?: (() => void) | undefined;
  /** C10-A：本机数据的保护级别；null/undefined = 还不知道，不显示 */
  dataProtection?: MasterKeyProtection | null | undefined;
}

/** 消息列表页 + 公告/我的两个 tab。单群试用版：消息列表只有当前这一个群。 */
export function MessageListScreen({
  groups,
  onOpenGroup,
  onOpenGroupSettings,
  onJoinAnotherGroup,
  todayContent,
  isAdmin,
  onOpenAdmin,
  onAdminUnlocked,
  onOpenAdminRecovery,
  onOpenLockSetup,
  onOpenDiagnostics,
  onOpenDevices,
  onOpenEditProfile,
  deviceId,
  nickname,
  onOpenServerSettings,
  relayUrl,
  initialTab,
  screenSecurityEnabled,
  onToggleScreenSecurity,
  biometricEnabled,
  onToggleBiometric,
  lockEnabled,
  onOpenBackup,
  dataProtection,
}: MessageListScreenProps) {
  // 公告每天更新，是很多人打开这个应用的第一个理由——所以默认落在这里，
  // 而不是像通用 IM 那样落在会话列表。
  const [activeTab, setActiveTab] = useState<BottomNavKey>(initialTab ?? "announcements");
  const [tapState, setTapState] = useState<TapState>(INITIAL_TAP_STATE);
  const [tapHint, setTapHint] = useState<string | null>(null);

  const inputStyle = {
    minHeight: touchTarget.minDp,
    border: `0.5px solid ${colors.sageMint}`,
    borderRadius: 14,
    padding: "8px 16px",
    fontSize: 14,
    background: colors.ivory,
    color: colors.textPrimary,
    boxShadow: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 8px", fontSize: 16, fontWeight: 500, color: colors.deepInkGreen }}>
        {t("app.name")}
      </div>

      <div style={{ flex: 1, padding: "0 12px" }}>
        {activeTab === "messages" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px 24px" }}>
                <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 6 }}>{t("list.emptyTitle")}</div>
                <div style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7 }}>
                  {t("list.emptyLine1")}
                  <br />
                  {t("list.emptyLine2")}
                </div>
              </div>
            ) : null}
            {groups.map((g) => (
              <div key={g.groupId}>
                <MessageListItem
                  name={g.groupName}
                  previewText={g.lastMessage ? g.lastMessage.preview : t("list.noMessages")}
                  timeLabel={g.lastMessage ? formatListTime(g.lastMessage.sentAtMs) : ""}
                  unreadCount={g.unread}
                  onClick={() => onOpenGroup(g.groupId)}
                  onContextMenu={(e) => {
                    // 移动端长按走 contextmenu；不再需要先进群才能改名或退群
                    e.preventDefault();
                    onOpenGroupSettings(g.groupId);
                  }}
                />
                <div style={{ padding: "0 6px 6px 60px", fontSize: 11, color: "#9A9A94" }}>
                  {g.onlineCount > 0 ? t("group.onlineCount", { count: g.onlineCount }) : t("group.onlyYouOnline")}
                </div>
              </div>
            ))}

            <button
              onClick={onJoinAnotherGroup}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 12,
                background: "transparent",
                border: `0.5px dashed ${colors.sageMint}`,
                borderRadius: 14,
                color: colors.deepInkGreen,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t("list.joinOrCreate")}
            </button>
          </div>
        ) : activeTab === "announcements" ? (
          <TodayScreen content={todayContent} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />
        ) : (
          <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={onOpenEditProfile}
              style={{
                minHeight: touchTarget.minDp,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.nickname")}</div>
              <div style={{ fontSize: 15, color: colors.deepInkGreen }}>{nickname ?? t("me.notSet")}</div>
            </button>
            <LanguageSetting />
            <div style={{ fontSize: 13, color: colors.textPrimary, marginTop: 8 }}>{t("me.deviceIdentity")}</div>
            <div style={{ fontSize: 11, color: "#8A8A82", wordBreak: "break-all", fontFamily: "monospace" }}>
              {deviceId}
            </div>
            <button
              onClick={onOpenDevices}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 8,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.devices")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.devicesHint")}</div>
            </button>

            <button
              onClick={onOpenDiagnostics}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 8,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.diagnostics")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.diagnosticsHint")}</div>
            </button>

            <button
              onClick={onOpenServerSettings}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 12,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.server")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94", fontFamily: "monospace", wordBreak: "break-all" }}>
                {relayUrl}
              </div>
            </button>

            {onOpenBackup ? (
              <button
                onClick={onOpenBackup}
                style={{
                  minHeight: touchTarget.minDp,
                  marginTop: 8,
                  textAlign: "left",
                  background: "transparent",
                  border: `0.5px solid ${colors.sageMint}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.backup")}</div>
                <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.backupHint")}</div>
              </button>
            ) : null}

            {dataProtection ? (
              <div
                data-testid="data-protection"
                style={{
                  marginTop: 8,
                  border: `0.5px solid ${colors.sageMint}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                }}
              >
                <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.dataProtection")}</div>
                <div style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7 }}>{protectionText(dataProtection)}</div>
              </div>
            ) : null}

            <button
              onClick={() => {
                const result = registerTap(tapState);
                setTapState(result.state);
                if (result.unlocked) {
                  setTapHint(t("me.adminUnlocked"));
                  onAdminUnlocked();
                } else if (result.remaining <= 3) {
                  // 到最后三次才给提示——否则误触也会看到莫名其妙的倒数
                  setTapHint(t("me.tapsRemaining", { count: result.remaining }));
                } else {
                  setTapHint(null);
                }
              }}
              style={{
                minHeight: touchTarget.minDp,
                textAlign: "left",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                color: "#9A9A94",
                fontSize: 11,
                cursor: "default",
                marginTop: 12,
              }}
            >
              {t("me.version", { version: APP_VERSION })}
              {tapHint ? <span style={{ marginLeft: 8, color: colors.wheatGold }}>{tapHint}</span> : null}
            </button>

            <button
              onClick={onOpenLockSetup}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 8,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.appLock")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.appLockHint")}</div>
            </button>

            {onToggleBiometric ? (
              <button
                onClick={() => {
                  if (!lockEnabled) {
                    // 没有 PIN 就不能单独用生物识别——直接引导去设置应用密码
                    onOpenLockSetup();
                    return;
                  }
                  onToggleBiometric();
                }}
                style={{
                  minHeight: touchTarget.minDp,
                  marginTop: 8,
                  textAlign: "left",
                  background: "transparent",
                  border: `0.5px solid ${colors.sageMint}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.biometric")}</div>
                <div style={{ fontSize: 11, color: "#9A9A94" }}>
                  {!lockEnabled
                    ? t("me.biometricNeedsLock")
                    : biometricEnabled
                      ? t("me.biometricOn")
                      : t("me.biometricOff")}
                </div>
              </button>
            ) : null}

            {onToggleScreenSecurity ? (
            <button
              onClick={onToggleScreenSecurity}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 8,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.screenSecurity")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94" }}>
                {screenSecurityEnabled
                  ? t("me.screenSecurityOn")
                  : t("me.screenSecurityOff")}
              </div>
            </button>
            ) : null}

            <button
              onClick={onOpenAdminRecovery}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 8,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("me.adminRecovery")}</div>
              <div style={{ fontSize: 11, color: "#9A9A94" }}>{t("me.adminRecoveryHint")}</div>
            </button>

            <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.6, marginTop: 8 }}>
              {t("me.localDataNote")}
            </p>
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
