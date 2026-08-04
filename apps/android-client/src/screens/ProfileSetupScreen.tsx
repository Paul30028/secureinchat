import { useState } from "react";
import { colors, touchTarget, Button, Avatar } from "@secureinchat/ui";
import { validateNickname, NICKNAME_MAX_LENGTH } from "../profile";

export interface ProfileSetupScreenProps {
  onDone: (nickname: string) => Promise<void>;
}

/**
 * 首次个人设置。需求第七节：这一页只在第一次使用时出现一次，
 * 以后加入其他群聊不再要求重设——所以昵称存在设备本地、和群无关。
 *
 * 头像上传暂未实现，先用昵称首字生成的圆形占位（和消息列表里的头像同一套逻辑）。
 */
export function ProfileSetupScreen({ onDone }: ProfileSetupScreenProps) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleDone() {
    const result = validateNickname(nickname);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onDone(nickname.trim());
    } catch {
      setIsSaving(false);
      setError("保存失败，请重试");
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: colors.ivory,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <Avatar name={nickname || "?"} size="large" />
      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "8px 0 0" }}>
        设置你的昵称
      </h1>
      <p style={{ fontSize: 12, color: "#8A8A82", textAlign: "center", lineHeight: 1.7, margin: 0 }}>
        群里的其他人会看到这个名字。只需要设置一次，
        <br />
        以后加入别的群聊不用重复填写。
      </p>

      <div style={{ width: "100%", maxWidth: 320, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setError(null);
          }}
          placeholder="请输入昵称"
          aria-label="昵称输入框"
          maxLength={NICKNAME_MAX_LENGTH}
          style={{
            minHeight: touchTarget.minDp,
            border: `0.5px solid ${error ? "#A33" : colors.sageMint}`,
            borderRadius: 14,
            padding: "0 16px",
            fontSize: 14,
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
            textAlign: "center",
          }}
        />
        <div style={{ fontSize: 11, color: "#9A9A94", textAlign: "right" }}>
          {nickname.length}/{NICKNAME_MAX_LENGTH}
        </div>

        {error ? (
          <p role="alert" style={{ color: "#A33", fontSize: 12, margin: 0, textAlign: "center" }}>
            {error}
          </p>
        ) : null}

        <Button variant="primary" onClick={handleDone} disabled={isSaving || nickname.trim().length === 0}>
          {isSaving ? "保存中..." : "完成设置"}
        </Button>
      </div>
    </div>
  );
}
