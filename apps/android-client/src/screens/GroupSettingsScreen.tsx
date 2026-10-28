import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { DISAPPEAR_OPTIONS_MS } from "@secureinchat/chat-core";

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

/** 把时长转成界面上显示的中文标签。 */
export function disappearLabel(ms: number): string {
  if (ms === 300_000) return "5 分钟";
  if (ms === 3_600_000) return "1 小时";
  if (ms === 86_400_000) return "1 天";
  if (ms === 604_800_000) return "7 天";
  return "关闭";
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
        aria-label="返回"
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
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>群设置</h1>
      <p style={{ fontSize: 12, color: "#8A8A82", margin: "0 0 20px" }}>
        {memberCount > 0 ? `${memberCount} 位成员在线` : "群里暂时只有你在线"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary }}>群名称</div>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSavedNotice(false);
          }}
          aria-label="群名称输入框"
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
            已保存
          </p>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => void handleRename()}
          disabled={saving || name.trim().length === 0 || name.trim() === groupName}
        >
          {saving ? "保存中..." : "保存群名"}
        </Button>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: 0 }}>
          只改这台手机上显示的名字。中继不知道群叫什么，其他人那边不会跟着变。
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
            <div style={{ fontSize: 14, color: colors.textPrimary }}>邀请新成员</div>
            <div style={{ fontSize: 11, color: "#9A9A94" }}>重新打开邀请卡片，发给想拉进群的人</div>
          </button>
        </div>
      ) : null}

      {onSetDisappearAfter ? (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>消息定时消失</div>
          <div
            role="group"
            aria-label="消息定时消失"
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
                  {disappearLabel(ms)}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "10px 0 0" }}>
            只对你之后发出的消息生效。对方用的是旧版本应用时，消息在他那边不会消失；
            对方仍然可以截屏或拍照。
          </p>
        </div>
      ) : null}

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 28, paddingTop: 16 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>退出群聊</div>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 10px" }}>
          这台手机上的聊天记录会一起删掉，无法恢复——中继不保存任何消息。
          以后想回来需要重新用邀请码加入。
        </p>

        {!confirmLeave ? (
          <Button variant="secondary" onClick={() => setConfirmLeave(true)}>
            退出群聊
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => setConfirmLeave(false)} style={{ flex: 1 }}>
              取消
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
              {leaving ? "退出中..." : "确认退出"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
