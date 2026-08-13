import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";

export interface GroupSettingsScreenProps {
  groupName: string;
  memberCount: number;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onBack: () => void;
}

/**
 * 群设置：改名、退群。
 *
 * 改名只改本机显示的名字——中继不知道群叫什么，别人那边不会跟着变。
 * 这一点必须说出来，否则改完以为全群都看到了新名字。
 */
export function GroupSettingsScreen({
  groupName,
  memberCount,
  onRename,
  onLeave,
  onBack,
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
