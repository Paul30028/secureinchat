import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { DISAPPEAR_OPTIONS_MS } from "@secureinchat/chat-core";
import { useT } from "../i18n";
import type { Messages } from "../i18n";

export interface GroupSettingsScreenProps {
  groupName: string;
  memberCount: number;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onBack: () => void;
  /** 只有持有该群管理员私钥的设备才传这个；不传就不显示「邀请新成员」 */
  onShowInvite?: (() => void) | undefined;
  /** 当前群的「消息定时消失」时长（毫秒），0/缺省表示关闭 */
  disappearAfterMs?: number | undefined;
  /** 修改「消息定时消失」；不传就不显示这一段 */
  onSetDisappearAfter?: ((ms: number) => void) | undefined;
}

type DisappearKey = `groupSettings.disappear${string}`;

/** 时长到词条键的映射（与界面语言无关，不调用 t）。 */
const DISAPPEAR_KEYS: ReadonlyArray<readonly [number, DisappearKey]> = [
  [300_000, "groupSettings.disappear5min"],
  [3_600_000, "groupSettings.disappear1hour"],
  [86_400_000, "groupSettings.disappear1day"],
  [604_800_000, "groupSettings.disappear7days"],
];

/** 把时长转成界面上显示的中文标签。 */
export function disappearLabel(ms: number): string {
  if (ms === 300_000) return "5 分钟";
  if (ms === 3_600_000) return "1 小时";
  if (ms === 86_400_000) return "1 天";
  if (ms === 604_800_000) return "7 天";
  return "关闭";
}

/** 取时长对应的词条键，用于按当前语言渲染选项文字。 */
function disappearKey(ms: number): DisappearKey {
  for (const [value, key] of DISAPPEAR_KEYS) {
    if (value === ms) return key;
  }
  return "groupSettings.disappearOff";
}

/**
 * 群设置：改名、退群、邀请新成员、消息定时消失。
 *
 * 改名只改本机显示的名字——中继不知道群叫什么，别人那边不会跟着变。
 * 这一点必须说出来，否则改完以为全群都看到了新名字。
 *
 * 「邀请新成员」只有管理员看得到：邀请串里的人能派生出群密钥、读取之后
 * 的所有消息，不该让普通成员随手把卡片转出去。是否显示由调用方决定——
 * 这个组件只负责渲染。
 *
 * 「消息定时消失」是每台设备、每个群本地的设置，只影响自己之后发出的消息；
 * 收到的消息按消息里带的时长处理。对方用旧版本时消息不会消失，这一点
 * 在说明里写清楚，不做虚假承诺。
 */
export function GroupSettingsScreen({
  groupName,
  memberCount,
  onRename,
  onLeave,
  onBack,
  onShowInvite,
  disappearAfterMs,
  onSetDisappearAfter,
}: GroupSettingsScreenProps) {
  const t = useT();
  const [name, setName] = useState(groupName);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleRename() {
    setSaving(true);
    try {
      await onRename(name.trim());
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  }

  const currentDisappear = disappearAfterMs ?? 0;

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={onBack}
        aria-label={t("groupSettings.back")}
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        {t("groupSettings.backLabel")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>
        {t("groupSettings.title")}
      </h1>
      <p style={{ fontSize: 12, color: "#8A8A82", margin: "0 0 20px" }}>
        {memberCount > 0
          ? t("groupSettings.memberOnlineCount", { count: memberCount })
          : t("groupSettings.onlyYouOnline")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary }}>{t("groupSettings.groupName")}</div>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSavedNotice(false);
          }}
          aria-label={t("groupSettings.groupNameInputLabel")}
          style={{
            minHeight: touchTarget.minDp,
            border: `0.5px solid ${colors.sageMint}`,
            borderRadius: 14,
            padding: "0 16px",
            fontSize: 14,
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
          }}
        />
        {savedNotice ? (
          <p role="status" style={{ fontSize: 12, color: colors.deepInkGreen, margin: 0 }}>
            {t("groupSettings.saved")}
          </p>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => void handleRename()}
          disabled={saving || name.trim().length === 0 || name.trim() === groupName}
        >
          {saving ? t("groupSettings.saving") : t("groupSettings.saveGroupName")}
        </Button>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: 0 }}>
          {t("groupSettings.renameHint")}
        </p>
      </div>

      {onShowInvite ? (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={onShowInvite}
            style={{
              minHeight: touchTarget.minDp,
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: `0.5px solid ${colors.sageMint}`,
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            <div style={{ fontSize: 14, color: colors.textPrimary }}>
              {t("groupSettings.inviteMember")}
            </div>
            <div style={{ fontSize: 11, color: "#9A9A94" }}>
              {t("groupSettings.inviteHint")}
            </div>
          </button>
        </div>
      ) : null}

      {onSetDisappearAfter ? (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
            {t("groupSettings.disappearTitle")}
          </div>
          <div
            role="group"
            aria-label={t("groupSettings.disappearTitle")}
            style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            {DISAPPEAR_OPTIONS_MS.map((ms) => {
              const selected = ms === currentDisappear;
              return (
                <button
                  key={ms}
                  onClick={() => onSetDisappearAfter(ms)}
                  aria-pressed={selected}
                  style={{
                    minHeight: touchTarget.minDp,
                    minWidth: touchTarget.minDp,
                    padding: "0 14px",
                    background: selected ? colors.deepInkGreen : "transparent",
                    color: selected ? colors.ivory : colors.deepInkGreen,
                    border: `0.5px solid ${colors.sageMint}`,
                    borderRadius: 12,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "none",
                  }}
                >
                  {t(disappearKey(ms))}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "10px 0 0" }}>
            {t("groupSettings.disappearHint")}
          </p>
        </div>
      ) : null}

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 28, paddingTop: 16 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
          {t("groupSettings.leaveTitle")}
        </div>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 10px" }}>
          {t("groupSettings.leaveHint")}
        </p>

        {!confirmLeave ? (
          <Button variant="secondary" onClick={() => setConfirmLeave(true)}>
            {t("groupSettings.leaveTitle")}
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => setConfirmLeave(false)} style={{ flex: 1 }}>
              {t("groupSettings.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={leaving}
              onClick={() => {
                setLeaving(true);
                void onLeave().finally(() => setLeaving(false));
              }}
              style={{ flex: 1 }}
            >
              {leaving ? t("groupSettings.leaving") : t("groupSettings.confirmLeave")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
