import { useState } from "react";
import { colors, touchTarget, Button, Avatar } from "@secureinchat/ui";
import { validateNickname, saveNickname, NICKNAME_MAX_LENGTH } from "../profile";

export interface EditProfileScreenProps {
  currentNickname: string;
  onSaved: (nickname: string) => void;
  onBack: () => void;
}

/**
 * 改昵称。
 *
 * 首次设置页只出现一次（需求第七节），但昵称本身当然要能改——打错字、
 * 想换个称呼都很正常，没有入口的话只能清数据重来。
 *
 * 改完只影响之后发出的消息：已经发出去的消息里带的是当时的昵称，
 * 别人那边不会追溯更新。中继不保存消息，也就没有"回去改"的可能。
 */
export function EditProfileScreen({ currentNickname, onSaved, onBack }: EditProfileScreenProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const result = validateNickname(nickname);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setSaving(true);
    try {
      await saveNickname(nickname.trim());
      onSaved(nickname.trim());
    } catch {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24 }}>
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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Avatar name={nickname || "?"} size="large" />
        <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>修改昵称</h1>

        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
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

          <Button variant="primary" onClick={() => void handleSave()} disabled={saving || nickname.trim().length === 0}>
            {saving ? "保存中..." : "保存"}
          </Button>

          <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, textAlign: "center", marginTop: 4 }}>
            改名只影响之后发出的消息，已经发出去的不会变。
          </p>
        </div>
      </div>
    </div>
  );
}
